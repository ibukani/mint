use super::{
    auth::{google_client, list_google_calendars_with_token, refresh_access_token},
    run_blocking, EventListResponse, GoogleCalendarState, GoogleCalendarSyncResult, GoogleEvent,
    OutboxEvent, OutboxSource, API_ROOT,
};
use chrono::{DateTime, SecondsFormat, Utc};
use reqwest::blocking::Client;
use rusqlite::{params, Connection, OptionalExtension};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use tauri::{AppHandle, Manager};

use super::super::calendar::{database::open_store, CalendarStoreState};

fn flush_outbox(client: &Client, token: &str, connection: &Connection) -> Result<(), String> {
    let mut statement = connection
        .prepare(
            "SELECT id,event_id,calendar_id,operation,payload FROM calendar_outbox ORDER BY id",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
            ))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    for (row_id, local_id, calendar_id, operation, payload) in rows {
        let event: OutboxEvent =
            serde_json::from_str(&payload).map_err(|error| error.to_string())?;
        let encoded_calendar =
            url::form_urlencoded::byte_serialize(calendar_id.as_bytes()).collect::<String>();
        let remote_id = match &event.source {
            OutboxSource::Local => format!("{:x}", Sha256::digest(event.id.as_bytes())),
            OutboxSource::Google { event_id } => event_id.clone(),
        };
        let encoded_event =
            url::form_urlencoded::byte_serialize(remote_id.as_bytes()).collect::<String>();
        if operation != "create" {
            let remote_response = client
                .get(format!(
                    "{API_ROOT}/calendars/{encoded_calendar}/events/{encoded_event}"
                ))
                .bearer_auth(token)
                .send()
                .map_err(|error| error.to_string())?;
            if remote_response.status().as_u16() == 404 && operation == "delete" {
                connection
                    .execute("DELETE FROM calendar_outbox WHERE id=?1", [row_id])
                    .map_err(|error| error.to_string())?;
                continue;
            }
            let remote = remote_response
                .error_for_status()
                .map_err(|error| error.to_string())?
                .json::<GoogleEvent>()
                .map_err(|error| error.to_string())?;
            let remote_updated = remote
                .updated
                .as_deref()
                .map(|value| normalize_google_instant(value, "updated timestamp"))
                .transpose()?;
            let local_updated =
                normalize_google_instant(&event.updated_at, "local updated timestamp")?;
            if remote_updated
                .as_deref()
                .is_some_and(|updated| updated > local_updated.as_str())
            {
                upsert_event(connection, &calendar_id, "writer", &remote)?;
                connection
                    .execute("DELETE FROM calendar_outbox WHERE id=?1", [row_id])
                    .map_err(|error| error.to_string())?;
                continue;
            }
        }
        let response = match operation.as_str() {
            "create" => client
                .post(format!("{API_ROOT}/calendars/{encoded_calendar}/events"))
                .bearer_auth(token)
                .json(&event.write_body(true))
                .send(),
            "update" => client
                .patch(format!(
                    "{API_ROOT}/calendars/{encoded_calendar}/events/{encoded_event}"
                ))
                .bearer_auth(token)
                .json(&event.write_body(false))
                .send(),
            "delete" => client
                .delete(format!(
                    "{API_ROOT}/calendars/{encoded_calendar}/events/{encoded_event}"
                ))
                .bearer_auth(token)
                .send(),
            _ => return Err("Unknown calendar outbox operation.".to_string()),
        };
        match response.and_then(reqwest::blocking::Response::error_for_status) {
            Ok(response) => {
                if operation == "create" {
                    let remote: GoogleEvent = response.json().map_err(|error| error.to_string())?;
                    connection.execute(
                        "UPDATE calendar_events SET source_kind='google',source_calendar_id=?2,source_event_id=?3,source_etag=?4,source_access_role='writer',updated_at=?5 WHERE id=?1",
                        params![local_id, calendar_id, remote.id, remote.etag, event.updated_at],
                    ).map_err(|error| error.to_string())?;
                }
                connection
                    .execute("DELETE FROM calendar_outbox WHERE id=?1", [row_id])
                    .map_err(|error| error.to_string())?;
            }
            Err(error) => {
                connection
                    .execute(
                        "UPDATE calendar_outbox SET attempts=attempts+1,last_error=?2 WHERE id=?1",
                        params![row_id, error.to_string()],
                    )
                    .map_err(|db_error| db_error.to_string())?;
                return Err(error.to_string());
            }
        }
    }
    Ok(())
}

pub(super) fn pending_count(store: &CalendarStoreState) -> Result<u32, String> {
    stored_sync_status(store).map(|(pending, _)| pending)
}

pub(super) fn stored_sync_status(
    store: &CalendarStoreState,
) -> Result<(u32, Option<String>), String> {
    open_store(store.path())?
        .query_row(
            "SELECT
               (SELECT COUNT(*) FROM calendar_outbox),
               (SELECT MAX(last_synced_at) FROM google_calendar_sync)",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|error| error.to_string())
}

fn normalize_google_instant(value: &str, label: &str) -> Result<String, String> {
    DateTime::parse_from_rfc3339(value)
        .map(|instant| {
            instant
                .with_timezone(&Utc)
                .to_rfc3339_opts(SecondsFormat::Millis, true)
        })
        .map_err(|_| format!("Google Calendar returned an invalid {label}."))
}

pub(super) fn upsert_event(
    connection: &Connection,
    calendar_id: &str,
    access_role: &str,
    event: &GoogleEvent,
) -> Result<bool, String> {
    if event.status == "cancelled" {
        return connection
            .execute(
                "DELETE FROM calendar_events WHERE source_calendar_id=?1 AND source_event_id=?2",
                params![calendar_id, event.id],
            )
            .map(|count| count > 0)
            .map_err(|error| error.to_string());
    }
    let (Some(start), Some(end)) = (&event.start, &event.end) else {
        return Ok(false);
    };
    let (kind, start_date, end_date, starts_at, ends_at, time_zone) =
        if let (Some(start_date), Some(end_date)) = (&start.date, &end.date) {
            (
                "allDay",
                Some(start_date.clone()),
                Some(end_date.clone()),
                None,
                None,
                None,
            )
        } else if let (Some(starts_at), Some(ends_at)) = (&start.date_time, &end.date_time) {
            (
                "timed",
                None,
                None,
                Some(normalize_google_instant(starts_at, "event start")?),
                Some(normalize_google_instant(ends_at, "event end")?),
                Some(start.time_zone.clone().unwrap_or_else(|| "UTC".to_string())),
            )
        } else {
            return Ok(false);
        };
    let now = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
    let updated = match event.updated.as_deref() {
        Some(value) => normalize_google_instant(value, "updated timestamp")?,
        None => now.clone(),
    };
    let created = match event.created.as_deref() {
        Some(value) => normalize_google_instant(value, "created timestamp")?,
        None => updated.clone(),
    };
    let existing_updated: Option<String> = connection.query_row("SELECT updated_at FROM calendar_events WHERE source_calendar_id=?1 AND source_event_id=?2", params![calendar_id, event.id], |row| row.get(0)).optional().map_err(|error| error.to_string())?;
    if let Some(local) = existing_updated.as_deref() {
        let normalized_local = normalize_google_instant(local, "stored updated timestamp")?;
        if normalized_local > updated {
            return Ok(false);
        }
    }
    connection.execute(
         "INSERT INTO calendar_events (id,title,notes,schedule_kind,start_date,end_date_exclusive,starts_at,ends_at,time_zone,source_kind,source_calendar_id,source_event_id,source_etag,source_access_role,recurring_event_id,original_start_time,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,'google',?10,?11,?12,?13,?14,?15,?16,?17)
         ON CONFLICT(source_calendar_id,source_event_id) WHERE source_kind='google' DO UPDATE SET title=excluded.title,notes=excluded.notes,schedule_kind=excluded.schedule_kind,start_date=excluded.start_date,end_date_exclusive=excluded.end_date_exclusive,starts_at=excluded.starts_at,ends_at=excluded.ends_at,time_zone=excluded.time_zone,source_etag=excluded.source_etag,source_access_role=excluded.source_access_role,recurring_event_id=excluded.recurring_event_id,original_start_time=excluded.original_start_time,updated_at=excluded.updated_at",
        params![format!("google:{calendar_id}:{}", event.id), event.summary, event.description, kind, start_date, end_date, starts_at, ends_at, time_zone, calendar_id, event.id, event.etag, access_role, event.recurring_event_id, event.original_start_time.as_ref().and_then(|value| value.date_time.as_ref().or(value.date.as_ref())), created, updated]
    ).map(|count| count > 0).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn sync_google_calendars(
    calendar_ids: Vec<String>,
    app: AppHandle,
) -> Result<GoogleCalendarSyncResult, String> {
    run_blocking(move || sync_google_calendars_blocking(calendar_ids, app)).await
}

fn sync_google_calendars_blocking(
    calendar_ids: Vec<String>,
    app: AppHandle,
) -> Result<GoogleCalendarSyncResult, String> {
    let state = app.state::<GoogleCalendarState>();
    let store = app.state::<CalendarStoreState>();
    let _operation = state
        .operation
        .lock()
        .map_err(|_| "Google Calendar operation state is unavailable.".to_string())?;
    {
        let mut runtime = state
            .status
            .lock()
            .map_err(|_| "Google Calendar state is unavailable.".to_string())?;
        runtime.syncing = true;
        runtime.error = None;
    }

    let result = sync_google_calendars_inner(calendar_ids, store.inner());
    let mut runtime = state
        .status
        .lock()
        .map_err(|_| "Google Calendar state is unavailable.".to_string())?;
    runtime.syncing = false;
    match &result {
        Ok(sync_result) => {
            runtime.last_synced_at = Some(sync_result.synced_at.clone());
            runtime.error = None;
        }
        Err(error) => runtime.error = Some(error.clone()),
    }
    result
}

fn sync_google_calendars_inner(
    calendar_ids: Vec<String>,
    store: &CalendarStoreState,
) -> Result<GoogleCalendarSyncResult, String> {
    let token = refresh_access_token()?;
    let calendars = list_google_calendars_with_token(&token)?;
    let roles: HashMap<_, _> = calendars
        .into_iter()
        .map(|item| (item.id, item.access_role))
        .collect();
    let client = google_client()?;
    let connection = open_store(store.path())?;
    flush_outbox(&client, &token, &connection)?;
    let cached_calendar_ids = connection
        .prepare(
            "SELECT DISTINCT source_calendar_id FROM calendar_events WHERE source_kind='google'",
        )
        .and_then(|mut statement| {
            statement
                .query_map([], |row| row.get::<_, String>(0))?
                .collect::<Result<Vec<_>, _>>()
        })
        .map_err(|error| error.to_string())?;
    for cached_id in cached_calendar_ids {
        if !calendar_ids.contains(&cached_id) {
            connection
                .execute(
                    "DELETE FROM calendar_events WHERE source_calendar_id=?1",
                    [&cached_id],
                )
                .map_err(|error| error.to_string())?;
            connection
                .execute(
                    "DELETE FROM google_calendar_sync WHERE calendar_id=?1",
                    [&cached_id],
                )
                .map_err(|error| error.to_string())?;
        }
    }
    let mut changed = 0_u32;
    for calendar_id in &calendar_ids {
        let mut sync_token: Option<String> = connection
            .query_row(
                "SELECT sync_token FROM google_calendar_sync WHERE calendar_id=?1",
                [calendar_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|error| error.to_string())?
            .flatten();
        let mut reset_attempted = false;
        let next_sync_token = 'retry_sync: loop {
            let mut page_token: Option<String> = None;
            loop {
                let mut request = client
                    .get(format!(
                        "{API_ROOT}/calendars/{}/events",
                        url::form_urlencoded::byte_serialize(calendar_id.as_bytes())
                            .collect::<String>()
                    ))
                    .bearer_auth(&token)
                    .query(&[("singleEvents", "true"), ("showDeleted", "true")]);
                if let Some(value) = &sync_token {
                    request = request.query(&[("syncToken", value)]);
                }
                if let Some(value) = &page_token {
                    request = request.query(&[("pageToken", value)]);
                }
                let response = request.send().map_err(|error| error.to_string())?;
                if response.status().as_u16() == 410 {
                    if sync_token.is_none() || reset_attempted {
                        return Err(
                            "Google Calendar sync token reset failed repeatedly.".to_string()
                        );
                    }
                    connection
                        .execute(
                            "DELETE FROM calendar_events WHERE source_calendar_id=?1",
                            [calendar_id],
                        )
                        .map_err(|error| error.to_string())?;
                    connection
                        .execute(
                            "DELETE FROM google_calendar_sync WHERE calendar_id=?1",
                            [calendar_id],
                        )
                        .map_err(|error| error.to_string())?;
                    sync_token = None;
                    reset_attempted = true;
                    continue 'retry_sync;
                }
                let page = response
                    .error_for_status()
                    .map_err(|error| error.to_string())?
                    .json::<EventListResponse>()
                    .map_err(|error| error.to_string())?;
                for event in &page.items {
                    if upsert_event(
                        &connection,
                        calendar_id,
                        roles
                            .get(calendar_id)
                            .map(String::as_str)
                            .unwrap_or("reader"),
                        event,
                    )? {
                        changed += 1;
                    }
                }
                page_token = page.next_page_token;
                if page_token.is_none() {
                    break 'retry_sync page.next_sync_token;
                }
            }
        };
        let synced_at = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
        connection.execute("INSERT INTO google_calendar_sync(calendar_id,sync_token,last_synced_at,last_error) VALUES(?1,?2,?3,NULL) ON CONFLICT(calendar_id) DO UPDATE SET sync_token=excluded.sync_token,last_synced_at=excluded.last_synced_at,last_error=NULL", params![calendar_id, next_sync_token, synced_at]).map_err(|error| error.to_string())?;
    }
    let synced_at = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
    let pending = pending_count(store)?;
    Ok(GoogleCalendarSyncResult {
        synced_calendars: calendar_ids.len() as u32,
        changed_events: changed,
        pending_operations: pending,
        synced_at,
    })
}
