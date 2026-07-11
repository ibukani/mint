use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use chrono::{DateTime, SecondsFormat, Utc};
use reqwest::blocking::Client;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    io::{ErrorKind, Read, Write},
    net::TcpListener,
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;
use url::Url;
use uuid::Uuid;

use super::calendar::CalendarStoreState;

const TOKEN_SERVICE: &str = "com.ibuibu.mint.google_calendar";
const TOKEN_USER: &str = "refresh_token";
const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const API_ROOT: &str = "https://www.googleapis.com/calendar/v3";

#[derive(Default)]
pub struct GoogleCalendarState {
    status: Mutex<RuntimeStatus>,
}

#[derive(Default)]
struct RuntimeStatus {
    account_email: String,
    last_synced_at: Option<String>,
    error: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleCalendarConnection {
    connected: bool,
    account_email: String,
    last_synced_at: Option<String>,
    pending_operations: u32,
    error: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleCalendarInfo {
    id: String,
    name: String,
    primary: bool,
    access_role: String,
    background_color: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleCalendarSyncResult {
    synced_calendars: u32,
    changed_events: u32,
    pending_operations: u32,
    synced_at: String,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
}

#[derive(Deserialize)]
struct UserInfoResponse {
    #[serde(default)]
    email: String,
}

#[derive(Deserialize)]
struct CalendarListResponse {
    #[serde(default)]
    items: Vec<CalendarListEntry>,
    #[serde(rename = "nextPageToken")]
    next_page_token: Option<String>,
}

#[derive(Deserialize)]
struct CalendarListEntry {
    id: String,
    summary: String,
    #[serde(default)]
    primary: bool,
    #[serde(rename = "accessRole")]
    access_role: String,
    #[serde(rename = "backgroundColor", default)]
    background_color: String,
}

#[derive(Deserialize)]
struct EventListResponse {
    #[serde(default)]
    items: Vec<GoogleEvent>,
    #[serde(rename = "nextPageToken")]
    next_page_token: Option<String>,
    #[serde(rename = "nextSyncToken")]
    next_sync_token: Option<String>,
}

#[derive(Deserialize)]
struct GoogleEvent {
    id: String,
    #[serde(default)]
    etag: String,
    #[serde(default)]
    status: String,
    #[serde(default)]
    summary: String,
    #[serde(default)]
    description: String,
    created: Option<String>,
    updated: Option<String>,
    start: Option<EventDateTime>,
    end: Option<EventDateTime>,
    #[serde(rename = "recurringEventId")]
    recurring_event_id: Option<String>,
    #[serde(rename = "originalStartTime")]
    original_start_time: Option<EventDateTime>,
}

#[derive(Deserialize)]
struct EventDateTime {
    date: Option<String>,
    #[serde(rename = "dateTime")]
    date_time: Option<String>,
    #[serde(rename = "timeZone")]
    time_zone: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct OutboxEvent {
    id: String,
    title: String,
    notes: String,
    schedule: OutboxSchedule,
    source: OutboxSource,
    updated_at: String,
}

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum OutboxSchedule {
    AllDay {
        start_date: String,
        end_date_exclusive: String,
    },
    Timed {
        starts_at: String,
        ends_at: String,
        time_zone: String,
    },
}

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum OutboxSource {
    Local,
    Google { event_id: String },
}

#[derive(Serialize)]
struct GoogleWriteEvent<'a> {
    #[serde(skip_serializing_if = "Option::is_none")]
    id: Option<String>,
    summary: &'a str,
    description: &'a str,
    start: GoogleWriteDateTime<'a>,
    end: GoogleWriteDateTime<'a>,
    #[serde(rename = "extendedProperties")]
    extended_properties: GoogleExtendedProperties<'a>,
}

#[derive(Serialize)]
struct GoogleWriteDateTime<'a> {
    #[serde(skip_serializing_if = "Option::is_none")]
    date: Option<&'a str>,
    #[serde(rename = "dateTime", skip_serializing_if = "Option::is_none")]
    date_time: Option<&'a str>,
    #[serde(rename = "timeZone", skip_serializing_if = "Option::is_none")]
    time_zone: Option<&'a str>,
}

#[derive(Serialize)]
struct GoogleExtendedProperties<'a> {
    private: GooglePrivateProperties<'a>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GooglePrivateProperties<'a> {
    mint_local_id: &'a str,
}

impl OutboxEvent {
    fn write_body(&self, include_id: bool) -> GoogleWriteEvent<'_> {
        let (start, end) = match &self.schedule {
            OutboxSchedule::AllDay {
                start_date,
                end_date_exclusive,
            } => (
                GoogleWriteDateTime {
                    date: Some(start_date),
                    date_time: None,
                    time_zone: None,
                },
                GoogleWriteDateTime {
                    date: Some(end_date_exclusive),
                    date_time: None,
                    time_zone: None,
                },
            ),
            OutboxSchedule::Timed {
                starts_at,
                ends_at,
                time_zone,
            } => (
                GoogleWriteDateTime {
                    date: None,
                    date_time: Some(starts_at),
                    time_zone: Some(time_zone),
                },
                GoogleWriteDateTime {
                    date: None,
                    date_time: Some(ends_at),
                    time_zone: Some(time_zone),
                },
            ),
        };
        let deterministic_id = format!("{:x}", Sha256::digest(self.id.as_bytes()));
        GoogleWriteEvent {
            id: include_id.then_some(deterministic_id),
            summary: &self.title,
            description: &self.notes,
            start,
            end,
            extended_properties: GoogleExtendedProperties {
                private: GooglePrivateProperties {
                    mint_local_id: &self.id,
                },
            },
        }
    }
}

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

fn client_id() -> Result<&'static str, String> {
    option_env!("GOOGLE_CALENDAR_CLIENT_ID")
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "GOOGLE_CALENDAR_CLIENT_ID is not configured for this build.".to_string())
}

fn token_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(TOKEN_SERVICE, TOKEN_USER).map_err(|error| error.to_string())
}

fn load_refresh_token() -> Result<Option<String>, String> {
    match token_entry()?.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

fn refresh_access_token() -> Result<String, String> {
    let refresh_token =
        load_refresh_token()?.ok_or_else(|| "Google Calendar is not connected.".to_string())?;
    let response = Client::new()
        .post(TOKEN_URL)
        .form(&[
            ("client_id", client_id()?),
            ("refresh_token", refresh_token.as_str()),
            ("grant_type", "refresh_token"),
        ])
        .send()
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<TokenResponse>()
        .map_err(|error| error.to_string())?;
    Ok(response.access_token)
}

fn pending_count(store: &CalendarStoreState) -> Result<u32, String> {
    Connection::open(store.path())
        .map_err(|error| error.to_string())?
        .query_row("SELECT COUNT(*) FROM calendar_outbox", [], |row| row.get(0))
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

#[tauri::command]
pub fn get_google_calendar_connection(
    state: tauri::State<'_, GoogleCalendarState>,
    store: tauri::State<'_, CalendarStoreState>,
) -> Result<GoogleCalendarConnection, String> {
    let connected = load_refresh_token()?.is_some();
    let status = state
        .status
        .lock()
        .map_err(|_| "Google Calendar state is unavailable.".to_string())?;
    Ok(GoogleCalendarConnection {
        connected,
        account_email: status.account_email.clone(),
        last_synced_at: status.last_synced_at.clone(),
        pending_operations: pending_count(&store)?,
        error: status.error.clone(),
    })
}

#[tauri::command]
pub fn connect_google_calendar(
    app: AppHandle,
    state: tauri::State<'_, GoogleCalendarState>,
) -> Result<GoogleCalendarConnection, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|error| error.to_string())?;
    listener
        .set_nonblocking(true)
        .map_err(|error| error.to_string())?;
    let redirect_uri = format!(
        "http://127.0.0.1:{}",
        listener
            .local_addr()
            .map_err(|error| error.to_string())?
            .port()
    );
    let verifier = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let csrf_state = Uuid::new_v4().simple().to_string();
    let mut auth_url = Url::parse(AUTH_URL).map_err(|error| error.to_string())?;
    auth_url
        .query_pairs_mut()
        .append_pair("client_id", client_id()?)
        .append_pair("redirect_uri", &redirect_uri)
        .append_pair("response_type", "code")
        .append_pair(
            "scope",
            "openid email https://www.googleapis.com/auth/calendar",
        )
        .append_pair("access_type", "offline")
        .append_pair("prompt", "consent")
        .append_pair("code_challenge", &challenge)
        .append_pair("code_challenge_method", "S256")
        .append_pair("state", &csrf_state);
    app.opener()
        .open_url(auth_url.as_str(), None::<&str>)
        .map_err(|error| error.to_string())?;
    let deadline = Instant::now() + Duration::from_secs(120);
    let (mut stream, _) = loop {
        match listener.accept() {
            Ok(connection) => break connection,
            Err(error) if error.kind() == ErrorKind::WouldBlock && Instant::now() < deadline => {
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(error) if error.kind() == ErrorKind::WouldBlock => {
                return Err("Google authorization timed out.".to_string());
            }
            Err(error) => return Err(error.to_string()),
        }
    };
    stream
        .set_read_timeout(Some(Duration::from_secs(120)))
        .map_err(|error| error.to_string())?;
    let mut buffer = [0_u8; 8192];
    let read = stream
        .read(&mut buffer)
        .map_err(|error| error.to_string())?;
    let request = String::from_utf8_lossy(&buffer[..read]);
    let target = request
        .split_whitespace()
        .nth(1)
        .ok_or_else(|| "Invalid OAuth callback.".to_string())?;
    let callback =
        Url::parse(&format!("http://127.0.0.1{target}")).map_err(|error| error.to_string())?;
    let query: HashMap<_, _> = callback.query_pairs().into_owned().collect();
    if query.get("state") != Some(&csrf_state) {
        return Err("OAuth state validation failed.".to_string());
    }
    let code = query.get("code").ok_or_else(|| {
        query
            .get("error")
            .cloned()
            .unwrap_or_else(|| "Authorization was cancelled.".to_string())
    })?;
    let _ = stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\nGoogle Calendar connected. You can close this window.");
    let token = Client::new()
        .post(TOKEN_URL)
        .form(&[
            ("client_id", client_id()?),
            ("code", code.as_str()),
            ("code_verifier", verifier.as_str()),
            ("grant_type", "authorization_code"),
            ("redirect_uri", redirect_uri.as_str()),
        ])
        .send()
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<TokenResponse>()
        .map_err(|error| error.to_string())?;
    let refresh_token = token
        .refresh_token
        .ok_or_else(|| "Google did not return a refresh token.".to_string())?;
    token_entry()?
        .set_password(&refresh_token)
        .map_err(|error| error.to_string())?;
    let profile = Client::new()
        .get("https://openidconnect.googleapis.com/v1/userinfo")
        .bearer_auth(&token.access_token)
        .send()
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<UserInfoResponse>()
        .map_err(|error| error.to_string())?;
    let mut runtime = state
        .status
        .lock()
        .map_err(|_| "Google Calendar state is unavailable.".to_string())?;
    runtime.account_email = profile.email;
    runtime.error = None;
    Ok(GoogleCalendarConnection {
        connected: true,
        account_email: runtime.account_email.clone(),
        last_synced_at: runtime.last_synced_at.clone(),
        pending_operations: 0,
        error: None,
    })
}

#[tauri::command]
pub fn list_google_calendars() -> Result<Vec<GoogleCalendarInfo>, String> {
    let token = refresh_access_token()?;
    let client = Client::new();
    let mut page_token: Option<String> = None;
    let mut result = Vec::new();
    loop {
        let mut request = client
            .get(format!("{API_ROOT}/users/me/calendarList"))
            .bearer_auth(&token);
        if let Some(value) = &page_token {
            request = request.query(&[("pageToken", value)]);
        }
        let page = request
            .send()
            .map_err(|error| error.to_string())?
            .error_for_status()
            .map_err(|error| error.to_string())?
            .json::<CalendarListResponse>()
            .map_err(|error| error.to_string())?;
        result.extend(page.items.into_iter().map(|item| GoogleCalendarInfo {
            id: item.id,
            name: item.summary,
            primary: item.primary,
            access_role: item.access_role,
            background_color: item.background_color,
        }));
        page_token = page.next_page_token;
        if page_token.is_none() {
            break;
        }
    }
    Ok(result)
}

fn upsert_event(
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
pub fn sync_google_calendars(
    calendar_ids: Vec<String>,
    state: tauri::State<'_, GoogleCalendarState>,
    store: tauri::State<'_, CalendarStoreState>,
) -> Result<GoogleCalendarSyncResult, String> {
    let token = refresh_access_token()?;
    let calendars = list_google_calendars()?;
    let roles: HashMap<_, _> = calendars
        .into_iter()
        .map(|item| (item.id, item.access_role))
        .collect();
    let client = Client::new();
    let connection = Connection::open(store.path()).map_err(|error| error.to_string())?;
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
                            "Google Calendar sync token reset failed repeatedly.".to_string(),
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
    let pending = pending_count(&store)?;
    let mut runtime = state
        .status
        .lock()
        .map_err(|_| "Google Calendar state is unavailable.".to_string())?;
    runtime.last_synced_at = Some(synced_at.clone());
    runtime.error = None;
    Ok(GoogleCalendarSyncResult {
        synced_calendars: calendar_ids.len() as u32,
        changed_events: changed,
        pending_operations: pending,
        synced_at,
    })
}

#[tauri::command]
pub fn disconnect_google_calendar(
    store: tauri::State<'_, CalendarStoreState>,
) -> Result<(), String> {
    if pending_count(&store)? > 0 {
        return Err("Unsynced calendar changes must be resolved before disconnecting.".to_string());
    }
    if let Some(token) = load_refresh_token()? {
        let _ = Client::new()
            .post("https://oauth2.googleapis.com/revoke")
            .form(&[("token", token)])
            .send();
    }
    match token_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => {}
        Err(error) => return Err(error.to_string()),
    }
    let connection = Connection::open(store.path()).map_err(|error| error.to_string())?;
    connection
        .execute("DELETE FROM calendar_events WHERE source_kind='google'", [])
        .map_err(|error| error.to_string())?;
    connection
        .execute("DELETE FROM google_calendar_sync", [])
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_connection() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "CREATE TABLE calendar_events (
                   id TEXT PRIMARY KEY NOT NULL,
                   title TEXT NOT NULL,
                   notes TEXT NOT NULL,
                   schedule_kind TEXT NOT NULL,
                   start_date TEXT,
                   end_date_exclusive TEXT,
                   starts_at TEXT,
                   ends_at TEXT,
                   time_zone TEXT,
                   source_kind TEXT NOT NULL,
                   source_calendar_id TEXT,
                   source_event_id TEXT,
                   source_etag TEXT,
                   source_access_role TEXT,
                   recurring_event_id TEXT,
                   original_start_time TEXT,
                   created_at TEXT NOT NULL,
                   updated_at TEXT NOT NULL
                 );
                 CREATE UNIQUE INDEX calendar_events_google_identity
                   ON calendar_events(source_calendar_id, source_event_id)
                   WHERE source_kind = 'google';",
            )
            .unwrap();
        connection
    }

    #[test]
    fn normalizes_google_event_instants_before_persisting() {
        let connection = test_connection();
        let event = GoogleEvent {
            id: "remote-event".to_string(),
            etag: "etag".to_string(),
            status: "confirmed".to_string(),
            summary: "会議".to_string(),
            description: String::new(),
            created: Some("2026-07-10T18:00:00-07:00".to_string()),
            updated: Some("2026-07-10T18:30:00-07:00".to_string()),
            start: Some(EventDateTime {
                date: None,
                date_time: Some("2026-07-11T09:00:00+09:00".to_string()),
                time_zone: Some("Asia/Tokyo".to_string()),
            }),
            end: Some(EventDateTime {
                date: None,
                date_time: Some("2026-07-11T10:00:00+09:00".to_string()),
                time_zone: Some("Asia/Tokyo".to_string()),
            }),
            recurring_event_id: None,
            original_start_time: None,
        };

        assert!(upsert_event(&connection, "primary", "writer", &event).unwrap());

        let stored: (String, String, String, String) = connection
            .query_row(
                "SELECT starts_at,ends_at,created_at,updated_at FROM calendar_events WHERE source_event_id=?1",
                [&event.id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .unwrap();
        assert_eq!(stored.0, "2026-07-11T00:00:00.000Z");
        assert_eq!(stored.1, "2026-07-11T01:00:00.000Z");
        assert_eq!(stored.2, "2026-07-11T01:00:00.000Z");
        assert_eq!(stored.3, "2026-07-11T01:30:00.000Z");
    }
}
