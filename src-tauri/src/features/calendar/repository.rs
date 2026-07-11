use super::{
    database::open_store,
    validation::{schedule_columns, validate_date, validate_input, validate_instant},
    CalendarEvent, CalendarEventCursor, CalendarEventInput, CalendarEventRange,
    CalendarEventSchedule, CalendarEventSource, CalendarStoreState,
};
use chrono::{SecondsFormat, Utc};
use rusqlite::{params, types::Type, Connection, OptionalExtension, Row};
use std::{io, path::Path};
use tauri::AppHandle;
use uuid::Uuid;

pub(super) fn invalid_row(column: usize, message: &str) -> rusqlite::Error {
    rusqlite::Error::FromSqlConversionFailure(
        column,
        Type::Text,
        Box::new(io::Error::new(io::ErrorKind::InvalidData, message)),
    )
}

pub(super) fn event_from_row(row: &Row<'_>) -> rusqlite::Result<CalendarEvent> {
    let schedule_kind: String = row.get(3)?;
    let schedule = match schedule_kind.as_str() {
        "allDay" => CalendarEventSchedule::AllDay {
            start_date: row
                .get::<_, Option<String>>(4)?
                .ok_or_else(|| invalid_row(4, "all-day event is missing start_date"))?,
            end_date_exclusive: row
                .get::<_, Option<String>>(5)?
                .ok_or_else(|| invalid_row(5, "all-day event is missing end_date_exclusive"))?,
        },
        "timed" => CalendarEventSchedule::Timed {
            starts_at: row
                .get::<_, Option<String>>(6)?
                .ok_or_else(|| invalid_row(6, "timed event is missing starts_at"))?,
            ends_at: row
                .get::<_, Option<String>>(7)?
                .ok_or_else(|| invalid_row(7, "timed event is missing ends_at"))?,
            time_zone: row
                .get::<_, Option<String>>(8)?
                .ok_or_else(|| invalid_row(8, "timed event is missing time_zone"))?,
        },
        _ => return Err(invalid_row(3, "unknown schedule kind")),
    };

    let source_kind: String = row.get(9)?;
    let source = match source_kind.as_str() {
        "local" => CalendarEventSource::Local,
        "google" => CalendarEventSource::Google {
            calendar_id: row.get(10)?,
            event_id: row.get(11)?,
            etag: row.get(12)?,
            access_role: row.get(13)?,
            recurring_event_id: row.get(14)?,
            original_start_time: row.get(15)?,
        },
        _ => return Err(invalid_row(9, "unknown source kind")),
    };

    Ok(CalendarEvent {
        id: row.get(0)?,
        title: row.get(1)?,
        notes: row.get(2)?,
        schedule,
        source,
        created_at: row.get(16)?,
        updated_at: row.get(17)?,
    })
}

const EVENT_SELECT: &str =
    "SELECT id, title, notes, schedule_kind, start_date, end_date_exclusive, starts_at, ends_at, time_zone, source_kind, source_calendar_id, source_event_id, source_etag, source_access_role, recurring_event_id, original_start_time, created_at, updated_at FROM calendar_events";

pub(super) fn load_event(connection: &Connection, id: &str) -> Result<CalendarEvent, String> {
    connection
        .query_row(
            &format!("{EVENT_SELECT} WHERE id = ?1"),
            params![id],
            event_from_row,
        )
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "Calendar event was not found.".to_string())
}

pub(super) fn list_calendar_events_from_store(
    path: &Path,
    mut range: CalendarEventRange,
) -> Result<Vec<CalendarEvent>, String> {
    range.start_instant = validate_instant(&range.start_instant, "startInstant")?
        .with_timezone(&Utc)
        .to_rfc3339_opts(SecondsFormat::Millis, true);
    range.end_instant = validate_instant(&range.end_instant, "endInstant")?
        .with_timezone(&Utc)
        .to_rfc3339_opts(SecondsFormat::Millis, true);
    validate_date(&range.start_date, "startDate")?;
    validate_date(&range.end_date_exclusive, "endDateExclusive")?;

    let connection = open_store(path)?;
    let sql = format!(
        "{EVENT_SELECT}
         WHERE (schedule_kind = 'allDay' AND start_date < ?4 AND end_date_exclusive > ?3)
            OR (schedule_kind = 'timed' AND starts_at < ?2 AND ends_at > ?1)
         ORDER BY COALESCE(start_date, starts_at), title"
    );
    let mut statement = connection
        .prepare(&sql)
        .map_err(|error| error.to_string())?;
    let events = statement
        .query_map(
            params![
                range.start_instant,
                range.end_instant,
                range.start_date,
                range.end_date_exclusive
            ],
            event_from_row,
        )
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(events)
}

pub(super) fn get_next_calendar_event_from_store(
    path: &Path,
    mut cursor: CalendarEventCursor,
) -> Result<Option<CalendarEvent>, String> {
    cursor.now_instant = validate_instant(&cursor.now_instant, "nowInstant")?
        .with_timezone(&Utc)
        .to_rfc3339_opts(SecondsFormat::Millis, true);
    validate_date(&cursor.today_date, "todayDate")?;

    let connection = open_store(path)?;
    let sql = format!(
        "{EVENT_SELECT}
         WHERE (schedule_kind = 'allDay' AND end_date_exclusive > ?2)
            OR (schedule_kind = 'timed' AND ends_at > ?1)
         ORDER BY
           CASE
             WHEN schedule_kind = 'allDay' AND start_date <= ?2 THEN 0
             WHEN schedule_kind = 'timed' AND starts_at <= ?1 THEN 0
             ELSE 1
           END,
           COALESCE(start_date, starts_at),
           title
         LIMIT 1"
    );
    connection
        .query_row(
            &sql,
            params![cursor.now_instant, cursor.today_date],
            event_from_row,
        )
        .optional()
        .map_err(|error| error.to_string())
}

#[cfg(test)]
pub(super) fn create_calendar_event_in_store(
    path: &Path,
    input: CalendarEventInput,
) -> Result<CalendarEvent, String> {
    let connection = open_store(path)?;
    create_calendar_event_in_connection(&connection, input)
}

pub(super) fn create_calendar_event_in_connection(
    connection: &Connection,
    input: CalendarEventInput,
) -> Result<CalendarEvent, String> {
    let input = validate_input(input)?;
    let timestamp = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
    let event = CalendarEvent {
        id: Uuid::new_v4().to_string(),
        title: input.title,
        notes: input.notes,
        schedule: input.schedule,
        source: CalendarEventSource::Local,
        created_at: timestamp.clone(),
        updated_at: timestamp,
    };
    let (kind, start_date, end_date, starts_at, ends_at, time_zone) =
        schedule_columns(&event.schedule);
    connection
        .execute(
            "INSERT INTO calendar_events (
               id, title, notes, schedule_kind, start_date, end_date_exclusive,
               starts_at, ends_at, time_zone, source_kind, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'local', ?10, ?11)",
            params![
                event.id,
                event.title,
                event.notes,
                kind,
                start_date,
                end_date,
                starts_at,
                ends_at,
                time_zone,
                event.created_at,
                event.updated_at,
            ],
        )
        .map_err(|error| error.to_string())?;
    Ok(event)
}

#[cfg(test)]
pub(super) fn update_calendar_event_in_store(
    path: &Path,
    id: String,
    input: CalendarEventInput,
) -> Result<CalendarEvent, String> {
    let connection = open_store(path)?;
    update_calendar_event_in_connection(&connection, &id, input)
}

pub(super) fn update_calendar_event_in_connection(
    connection: &Connection,
    id: &str,
    input: CalendarEventInput,
) -> Result<CalendarEvent, String> {
    let input = validate_input(input)?;
    let (kind, start_date, end_date, starts_at, ends_at, time_zone) =
        schedule_columns(&input.schedule);
    let updated_at = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
    let changed = connection
        .execute(
            "UPDATE calendar_events SET
               title = ?2, notes = ?3, schedule_kind = ?4, start_date = ?5,
               end_date_exclusive = ?6, starts_at = ?7, ends_at = ?8,
               time_zone = ?9, updated_at = ?10
             WHERE id = ?1",
            params![
                id,
                input.title,
                input.notes,
                kind,
                start_date,
                end_date,
                starts_at,
                ends_at,
                time_zone,
                updated_at,
            ],
        )
        .map_err(|error| error.to_string())?;
    if changed == 0 {
        return Err("Calendar event was not found.".to_string());
    }
    load_event(connection, id)
}

#[cfg(test)]
pub(super) fn delete_calendar_event_in_store(path: &Path, id: String) -> Result<(), String> {
    let connection = open_store(path)?;
    delete_calendar_event_in_connection(&connection, &id)
}

pub(super) fn delete_calendar_event_in_connection(
    connection: &Connection,
    id: &str,
) -> Result<(), String> {
    let changed = connection
        .execute("DELETE FROM calendar_events WHERE id = ?1", params![id])
        .map_err(|error| error.to_string())?;
    if changed == 0 {
        return Err("Calendar event was not found.".to_string());
    }
    Ok(())
}

#[cfg(test)]
pub(super) fn queue_google_operation(
    path: &Path,
    calendar_id: &str,
    event: &CalendarEvent,
    operation: &str,
) -> Result<(), String> {
    let connection = open_store(path)?;
    queue_google_operation_in_connection(&connection, calendar_id, event, operation)
}

pub(super) fn queue_google_operation_in_connection(
    connection: &Connection,
    calendar_id: &str,
    event: &CalendarEvent,
    operation: &str,
) -> Result<(), String> {
    let payload = serde_json::to_string(event).map_err(|error| error.to_string())?;
    connection
        .execute(
            "DELETE FROM calendar_outbox WHERE event_id=?1 AND operation!='delete'",
            [&event.id],
        )
        .map_err(|error| error.to_string())?;
    connection
        .execute(
            "INSERT INTO calendar_outbox(event_id,calendar_id,operation,payload,local_updated_at) VALUES(?1,?2,?3,?4,?5)",
            params![event.id, calendar_id, operation, payload, event.updated_at],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub(super) fn pending_create_calendar_id(
    connection: &Connection,
    event_id: &str,
) -> Result<Option<String>, String> {
    connection
        .query_row(
            "SELECT calendar_id FROM calendar_outbox WHERE event_id=?1 AND operation='create' ORDER BY id DESC LIMIT 1",
            [event_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())
}

pub(super) fn create_calendar_event_with_sync_target(
    path: &Path,
    input: CalendarEventInput,
    calendar_id: Option<&str>,
) -> Result<CalendarEvent, String> {
    let mut connection = open_store(path)?;
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    let event = create_calendar_event_in_connection(&transaction, input)?;
    if let Some(calendar_id) = calendar_id.map(str::trim).filter(|value| !value.is_empty()) {
        queue_google_operation_in_connection(&transaction, calendar_id, &event, "create")?;
    }
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(event)
}

pub(super) fn update_calendar_event_with_sync(
    path: &Path,
    id: String,
    input: CalendarEventInput,
) -> Result<CalendarEvent, String> {
    let mut connection = open_store(path)?;
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    let existing = load_event(&transaction, &id)?;
    if matches!(
        &existing.source,
        CalendarEventSource::Google { access_role, .. } if !matches!(access_role.as_str(), "writer" | "owner")
    ) {
        return Err("This Google Calendar is read-only.".to_string());
    }

    let event = update_calendar_event_in_connection(&transaction, &id, input)?;
    match &event.source {
        CalendarEventSource::Google { calendar_id, .. } => {
            queue_google_operation_in_connection(&transaction, calendar_id, &event, "update")?;
        }
        CalendarEventSource::Local => {
            if let Some(calendar_id) = pending_create_calendar_id(&transaction, &event.id)? {
                queue_google_operation_in_connection(&transaction, &calendar_id, &event, "create")?;
            }
        }
    }

    transaction.commit().map_err(|error| error.to_string())?;
    Ok(event)
}

pub(super) fn delete_calendar_event_with_sync(path: &Path, id: String) -> Result<(), String> {
    let mut connection = open_store(path)?;
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    let event = load_event(&transaction, &id)?;
    if matches!(
        &event.source,
        CalendarEventSource::Google { access_role, .. } if !matches!(access_role.as_str(), "writer" | "owner")
    ) {
        return Err("This Google Calendar is read-only.".to_string());
    }

    match &event.source {
        CalendarEventSource::Google { calendar_id, .. } => {
            queue_google_operation_in_connection(&transaction, calendar_id, &event, "delete")?;
        }
        CalendarEventSource::Local => {
            transaction
                .execute("DELETE FROM calendar_outbox WHERE event_id=?1", [&event.id])
                .map_err(|error| error.to_string())?;
        }
    }
    delete_calendar_event_in_connection(&transaction, &id)?;
    transaction.commit().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_calendar_events(
    range: CalendarEventRange,
    state: tauri::State<'_, CalendarStoreState>,
) -> Result<Vec<CalendarEvent>, String> {
    list_calendar_events_from_store(&state.path, range)
}

#[tauri::command]
pub fn get_next_calendar_event(
    cursor: CalendarEventCursor,
    state: tauri::State<'_, CalendarStoreState>,
) -> Result<Option<CalendarEvent>, String> {
    get_next_calendar_event_from_store(&state.path, cursor)
}

#[tauri::command]
pub fn create_calendar_event(
    app: AppHandle,
    input: CalendarEventInput,
    state: tauri::State<'_, CalendarStoreState>,
) -> Result<CalendarEvent, String> {
    let settings = crate::core::settings::load_settings_internal(&app)?;
    create_calendar_event_with_sync_target(
        &state.path,
        input,
        Some(settings.calendar.default_google_calendar_id.as_str()),
    )
}

#[tauri::command]
pub fn update_calendar_event(
    id: String,
    input: CalendarEventInput,
    state: tauri::State<'_, CalendarStoreState>,
) -> Result<CalendarEvent, String> {
    update_calendar_event_with_sync(&state.path, id, input)
}

#[tauri::command]
pub fn delete_calendar_event(
    id: String,
    state: tauri::State<'_, CalendarStoreState>,
) -> Result<(), String> {
    delete_calendar_event_with_sync(&state.path, id)
}
