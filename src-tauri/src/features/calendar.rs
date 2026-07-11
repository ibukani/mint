use chrono::{DateTime, NaiveDate, SecondsFormat, Utc};
use rusqlite::{params, types::Type, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use std::{
    fs, io,
    path::{Path, PathBuf},
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition};
use uuid::Uuid;

const CALENDAR_HEIGHT: f64 = 400.0;
const WINDOW_MARGIN: f64 = 20.0;
const OVERLAY_PADDING: f64 = 8.0;
const WINDOW_PADDING: f64 = 16.0;
const CALENDAR_DB_VERSION: i64 = 2;

pub struct CalendarStoreState {
    path: PathBuf,
}

impl CalendarStoreState {
    pub(crate) fn path(&self) -> &Path {
        &self.path
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CalendarEventSource {
    Local,
    Google {
        #[serde(rename = "calendarId")]
        calendar_id: String,
        #[serde(rename = "eventId")]
        event_id: String,
        etag: String,
        #[serde(rename = "accessRole")]
        access_role: String,
        #[serde(rename = "recurringEventId")]
        recurring_event_id: Option<String>,
        #[serde(rename = "originalStartTime")]
        original_start_time: Option<String>,
    },
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CalendarEventSchedule {
    AllDay {
        #[serde(rename = "startDate")]
        start_date: String,
        #[serde(rename = "endDateExclusive")]
        end_date_exclusive: String,
    },
    Timed {
        #[serde(rename = "startsAt")]
        starts_at: String,
        #[serde(rename = "endsAt")]
        ends_at: String,
        #[serde(rename = "timeZone")]
        time_zone: String,
    },
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEventInput {
    title: String,
    notes: String,
    schedule: CalendarEventSchedule,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEvent {
    id: String,
    title: String,
    notes: String,
    schedule: CalendarEventSchedule,
    source: CalendarEventSource,
    created_at: String,
    updated_at: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEventRange {
    start_instant: String,
    end_instant: String,
    start_date: String,
    end_date_exclusive: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEventCursor {
    now_instant: String,
    today_date: String,
}

pub fn initialize_store(app: &AppHandle) -> Result<CalendarStoreState, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let state = CalendarStoreState {
        path: directory.join("calendar.sqlite3"),
    };
    open_store(&state.path)?;
    Ok(state)
}

fn open_store(path: &Path) -> Result<Connection, String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .busy_timeout(Duration::from_secs(5))
        .map_err(|error| error.to_string())?;
    migrate_store(&connection)?;
    Ok(connection)
}

fn migrate_store(connection: &Connection) -> Result<(), String> {
    let version: i64 = connection
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;

    match version {
        0 => connection
            .execute_batch(
                "BEGIN;
                 CREATE TABLE calendar_events (
                   id TEXT PRIMARY KEY NOT NULL,
                   title TEXT NOT NULL,
                   notes TEXT NOT NULL,
                   schedule_kind TEXT NOT NULL CHECK(schedule_kind IN ('allDay', 'timed')),
                   start_date TEXT,
                   end_date_exclusive TEXT,
                   starts_at TEXT,
                   ends_at TEXT,
                   time_zone TEXT,
                   source_kind TEXT NOT NULL CHECK(source_kind IN ('local', 'google')),
                   source_calendar_id TEXT,
                   source_event_id TEXT,
                   source_etag TEXT,
                   source_access_role TEXT,
                   recurring_event_id TEXT,
                   original_start_time TEXT,
                   created_at TEXT NOT NULL,
                   updated_at TEXT NOT NULL,
                   CHECK(
                     (schedule_kind = 'allDay' AND start_date IS NOT NULL AND end_date_exclusive IS NOT NULL AND starts_at IS NULL AND ends_at IS NULL AND time_zone IS NULL)
                     OR
                     (schedule_kind = 'timed' AND start_date IS NULL AND end_date_exclusive IS NULL AND starts_at IS NOT NULL AND ends_at IS NOT NULL AND time_zone IS NOT NULL)
                   )
                 );
                 CREATE INDEX calendar_events_all_day_range
                   ON calendar_events(start_date, end_date_exclusive)
                   WHERE schedule_kind = 'allDay';
                 CREATE INDEX calendar_events_timed_range
                   ON calendar_events(starts_at, ends_at)
                   WHERE schedule_kind = 'timed';
                 CREATE UNIQUE INDEX calendar_events_google_identity
                   ON calendar_events(source_calendar_id, source_event_id)
                   WHERE source_kind = 'google';
                 CREATE TABLE google_calendar_sync (
                   calendar_id TEXT PRIMARY KEY NOT NULL,
                   sync_token TEXT,
                   last_synced_at TEXT,
                   last_error TEXT
                 );
                 CREATE TABLE calendar_outbox (
                   id INTEGER PRIMARY KEY AUTOINCREMENT,
                   event_id TEXT NOT NULL,
                   calendar_id TEXT NOT NULL,
                   operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete')),
                   payload TEXT,
                   local_updated_at TEXT NOT NULL,
                   attempts INTEGER NOT NULL DEFAULT 0,
                   last_error TEXT
                 );
                 PRAGMA user_version = 2;
                 COMMIT;",
            )
            .map_err(|error| error.to_string()),
        1 => connection
            .execute_batch(
                "BEGIN;
                 ALTER TABLE calendar_events RENAME TO calendar_events_v1;
                 CREATE TABLE calendar_events (
                   id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, notes TEXT NOT NULL,
                   schedule_kind TEXT NOT NULL CHECK(schedule_kind IN ('allDay', 'timed')),
                   start_date TEXT, end_date_exclusive TEXT, starts_at TEXT, ends_at TEXT,
                   time_zone TEXT, source_kind TEXT NOT NULL CHECK(source_kind IN ('local', 'google')),
                   source_calendar_id TEXT, source_event_id TEXT, source_etag TEXT,
                   source_access_role TEXT, recurring_event_id TEXT, original_start_time TEXT,
                   created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
                   CHECK((schedule_kind = 'allDay' AND start_date IS NOT NULL AND end_date_exclusive IS NOT NULL AND starts_at IS NULL AND ends_at IS NULL AND time_zone IS NULL)
                     OR (schedule_kind = 'timed' AND start_date IS NULL AND end_date_exclusive IS NULL AND starts_at IS NOT NULL AND ends_at IS NOT NULL AND time_zone IS NOT NULL))
                 );
                 INSERT INTO calendar_events (id,title,notes,schedule_kind,start_date,end_date_exclusive,starts_at,ends_at,time_zone,source_kind,created_at,updated_at)
                   SELECT id,title,notes,schedule_kind,start_date,end_date_exclusive,starts_at,ends_at,time_zone,source_kind,created_at,updated_at FROM calendar_events_v1;
                 DROP TABLE calendar_events_v1;
                 CREATE INDEX calendar_events_all_day_range ON calendar_events(start_date,end_date_exclusive) WHERE schedule_kind='allDay';
                 CREATE INDEX calendar_events_timed_range ON calendar_events(starts_at,ends_at) WHERE schedule_kind='timed';
                 CREATE UNIQUE INDEX calendar_events_google_identity ON calendar_events(source_calendar_id,source_event_id) WHERE source_kind='google';
                 CREATE TABLE google_calendar_sync (calendar_id TEXT PRIMARY KEY NOT NULL, sync_token TEXT, last_synced_at TEXT, last_error TEXT);
                 CREATE TABLE calendar_outbox (id INTEGER PRIMARY KEY AUTOINCREMENT,event_id TEXT NOT NULL,calendar_id TEXT NOT NULL,operation TEXT NOT NULL CHECK(operation IN ('create','update','delete')),payload TEXT,local_updated_at TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,last_error TEXT);
                 PRAGMA user_version = 2;
                 COMMIT;",
            )
            .map_err(|error| error.to_string()),
        CALENDAR_DB_VERSION => Ok(()),
        _ => Err(format!("Unsupported calendar database version: {version}")),
    }
}

fn validate_date(value: &str, label: &str) -> Result<NaiveDate, String> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|_| format!("{label} must use YYYY-MM-DD format."))
}

fn validate_instant(value: &str, label: &str) -> Result<DateTime<chrono::FixedOffset>, String> {
    DateTime::parse_from_rfc3339(value)
        .map_err(|_| format!("{label} must be an RFC 3339 timestamp."))
}

fn validate_input(mut input: CalendarEventInput) -> Result<CalendarEventInput, String> {
    input.title = input.title.trim().to_string();
    if input.title.is_empty() {
        return Err("Title is required.".to_string());
    }

    match &mut input.schedule {
        CalendarEventSchedule::AllDay {
            start_date,
            end_date_exclusive,
        } => {
            let start = validate_date(start_date, "startDate")?;
            let end = validate_date(end_date_exclusive, "endDateExclusive")?;
            if end <= start {
                return Err("endDateExclusive must be after startDate.".to_string());
            }
        }
        CalendarEventSchedule::Timed {
            starts_at,
            ends_at,
            time_zone,
        } => {
            let start = validate_instant(starts_at, "startsAt")?;
            let end = validate_instant(ends_at, "endsAt")?;
            if end <= start {
                return Err("endsAt must be after startsAt.".to_string());
            }
            *starts_at = start
                .with_timezone(&Utc)
                .to_rfc3339_opts(SecondsFormat::Millis, true);
            *ends_at = end
                .with_timezone(&Utc)
                .to_rfc3339_opts(SecondsFormat::Millis, true);
            *time_zone = time_zone.trim().to_string();
            if time_zone.is_empty() {
                return Err("timeZone is required for timed events.".to_string());
            }
        }
    }

    Ok(input)
}

type ScheduleColumns<'a> = (
    &'static str,
    Option<&'a str>,
    Option<&'a str>,
    Option<&'a str>,
    Option<&'a str>,
    Option<&'a str>,
);

fn schedule_columns(schedule: &CalendarEventSchedule) -> ScheduleColumns<'_> {
    match schedule {
        CalendarEventSchedule::AllDay {
            start_date,
            end_date_exclusive,
        } => (
            "allDay",
            Some(start_date),
            Some(end_date_exclusive),
            None,
            None,
            None,
        ),
        CalendarEventSchedule::Timed {
            starts_at,
            ends_at,
            time_zone,
        } => (
            "timed",
            None,
            None,
            Some(starts_at),
            Some(ends_at),
            Some(time_zone),
        ),
    }
}

fn invalid_row(column: usize, message: &str) -> rusqlite::Error {
    rusqlite::Error::FromSqlConversionFailure(
        column,
        Type::Text,
        Box::new(io::Error::new(io::ErrorKind::InvalidData, message)),
    )
}

fn event_from_row(row: &Row<'_>) -> rusqlite::Result<CalendarEvent> {
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

fn load_event(connection: &Connection, id: &str) -> Result<CalendarEvent, String> {
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

fn list_calendar_events_from_store(
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

fn get_next_calendar_event_from_store(
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

fn create_calendar_event_in_store(
    path: &Path,
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
    let connection = open_store(path)?;
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

fn update_calendar_event_in_store(
    path: &Path,
    id: String,
    input: CalendarEventInput,
) -> Result<CalendarEvent, String> {
    let input = validate_input(input)?;
    let (kind, start_date, end_date, starts_at, ends_at, time_zone) =
        schedule_columns(&input.schedule);
    let updated_at = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
    let connection = open_store(path)?;
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
    load_event(&connection, &id)
}

fn delete_calendar_event_in_store(path: &Path, id: String) -> Result<(), String> {
    let connection = open_store(path)?;
    let changed = connection
        .execute("DELETE FROM calendar_events WHERE id = ?1", params![id])
        .map_err(|error| error.to_string())?;
    if changed == 0 {
        return Err("Calendar event was not found.".to_string());
    }
    Ok(())
}

fn queue_google_operation(
    path: &Path,
    calendar_id: &str,
    event: &CalendarEvent,
    operation: &str,
) -> Result<(), String> {
    let payload = serde_json::to_string(event).map_err(|error| error.to_string())?;
    let connection = open_store(path)?;
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
    let event = create_calendar_event_in_store(&state.path, input)?;
    let settings = crate::core::settings::load_settings_internal(&app)?;
    if !settings.calendar.default_google_calendar_id.is_empty() {
        queue_google_operation(
            &state.path,
            &settings.calendar.default_google_calendar_id,
            &event,
            "create",
        )?;
    }
    Ok(event)
}

#[tauri::command]
pub fn update_calendar_event(
    id: String,
    input: CalendarEventInput,
    state: tauri::State<'_, CalendarStoreState>,
) -> Result<CalendarEvent, String> {
    let connection = open_store(&state.path)?;
    let existing = load_event(&connection, &id)?;
    if matches!(
        &existing.source,
        CalendarEventSource::Google { access_role, .. } if !matches!(access_role.as_str(), "writer" | "owner")
    ) {
        return Err("This Google Calendar is read-only.".to_string());
    }
    drop(connection);
    let event = update_calendar_event_in_store(&state.path, id, input)?;
    if let CalendarEventSource::Google { calendar_id, .. } = &event.source {
        queue_google_operation(&state.path, calendar_id, &event, "update")?;
    }
    Ok(event)
}

#[tauri::command]
pub fn delete_calendar_event(
    id: String,
    state: tauri::State<'_, CalendarStoreState>,
) -> Result<(), String> {
    let connection = open_store(&state.path)?;
    let event = load_event(&connection, &id)?;
    if matches!(
        &event.source,
        CalendarEventSource::Google { access_role, .. } if !matches!(access_role.as_str(), "writer" | "owner")
    ) {
        return Err("This Google Calendar is read-only.".to_string());
    }
    drop(connection);
    if let CalendarEventSource::Google { calendar_id, .. } = &event.source {
        queue_google_operation(&state.path, calendar_id, &event, "delete")?;
    }
    delete_calendar_event_in_store(&state.path, id)
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CalendarShownPayload {
    close_clock_on_toggle: bool,
    docked: bool,
    initial_mode: CalendarOpenMode,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
enum CalendarOpenMode {
    Month,
    CreateEvent,
}

pub fn position_calendar(
    app: &AppHandle,
    docked: bool,
    settings: &crate::core::settings::AppSettings,
) {
    let Some(calendar) = app.get_webview_window("calendar") else {
        return;
    };

    let percent = settings.clock.size_percent as f64 / 100.0;
    let base_w = if settings.clock.display_mode == "analog" {
        240.0
    } else {
        420.0
    };
    let content_width_logical = (base_w * percent).max(420.0);
    let calendar_width_logical = content_width_logical + WINDOW_PADDING;
    let calendar_height_logical = CALENDAR_HEIGHT * (content_width_logical / 420.0);

    if docked {
        if let Some(clock) = app.get_webview_window("clock") {
            if let (Ok(clock_position), Ok(clock_size), Ok(Some(monitor))) = (
                clock.outer_position(),
                clock.outer_size(),
                clock.current_monitor(),
            ) {
                let scale = monitor.scale_factor();
                // Same formula as clock.rs: (width * scale) as u32
                let physical_width = (calendar_width_logical * scale) as u32;
                let calendar_h = (calendar_height_logical * scale).round() as u32;

                let _ = calendar.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(
                    physical_width,
                    calendar_h,
                )));

                let padding = (OVERLAY_PADDING * 2.0 * scale).round() as i32;
                let y = clock_position.y + clock_size.height as i32 - padding;
                let x = clock_position.x + clock_size.width as i32 - physical_width as i32;
                let _ =
                    calendar.set_position(tauri::Position::Physical(PhysicalPosition::new(x, y)));
                return;
            }
        }
    }

    // Fallback: non-docked or clock not available
    let monitor = calendar
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| app.primary_monitor().ok().flatten());
    if let Some(monitor) = monitor {
        let scale = monitor.scale_factor();
        // Same conversion as clock.rs: (width * scale) as u32
        let physical_width = (calendar_width_logical * scale) as u32;
        let calendar_h = (calendar_height_logical * scale).round() as u32;
        let margin = (WINDOW_MARGIN * scale) as u32;

        let _ = calendar.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(
            physical_width,
            calendar_h,
        )));

        let x = monitor.size().width.saturating_sub(physical_width + margin);
        let y = margin;
        let _ = calendar.set_position(tauri::Position::Physical(PhysicalPosition::new(
            x as i32, y as i32,
        )));
    }
}

pub fn toggle_calendar_overlay(app: &AppHandle) {
    let settings = match crate::core::settings::load_settings_internal(app) {
        Ok(settings) if settings.calendar.enabled => settings,
        _ => return,
    };
    let Some(calendar) = app.get_webview_window("calendar") else {
        return;
    };

    if calendar.is_visible().unwrap_or(false) {
        let _ = calendar.emit("calendar-hide-requested", ());
        return;
    }

    show_calendar_overlay(app, &settings, CalendarOpenMode::Month);
}

pub fn open_calendar_event_editor(app: &AppHandle) {
    let settings = match crate::core::settings::load_settings_internal(app) {
        Ok(settings) if settings.calendar.enabled => settings,
        _ => return,
    };
    let Some(calendar) = app.get_webview_window("calendar") else {
        return;
    };

    if calendar.is_visible().unwrap_or(false) {
        let _ = calendar.emit("calendar-create-requested", ());
        let _ = calendar.set_focus();
        return;
    }

    show_calendar_overlay(app, &settings, CalendarOpenMode::CreateEvent);
}

fn show_calendar_overlay(
    app: &AppHandle,
    settings: &crate::core::settings::AppSettings,
    initial_mode: CalendarOpenMode,
) {
    let Some(calendar) = app.get_webview_window("calendar") else {
        return;
    };

    let clock_was_visible = app
        .get_webview_window("clock")
        .and_then(|clock| clock.is_visible().ok())
        .unwrap_or(false);
    let should_show_clock = settings.clock.enabled && !clock_was_visible;

    if should_show_clock {
        crate::features::clock::show_clock_overlay(app, settings);
    }

    let docked = settings.clock.enabled
        && app
            .get_webview_window("clock")
            .and_then(|clock| clock.is_visible().ok())
            .unwrap_or(false);
    position_calendar(app, docked, settings);

    let _ = calendar.show();
    let _ = calendar.set_always_on_top(true);
    let _ = calendar.emit(
        "calendar-shown",
        CalendarShownPayload {
            close_clock_on_toggle: should_show_clock,
            docked,
            initial_mode,
        },
    );
    let _ = calendar.set_focus();

    if docked {
        if let Some(clock) = app.get_webview_window("clock") {
            let _ = clock.emit("calendar-opened", ());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_store_path() -> PathBuf {
        std::env::temp_dir().join(format!("mint-calendar-{}.sqlite3", Uuid::new_v4()))
    }

    fn timed_input(title: &str, starts_at: &str, ends_at: &str) -> CalendarEventInput {
        CalendarEventInput {
            title: title.to_string(),
            notes: String::new(),
            schedule: CalendarEventSchedule::Timed {
                starts_at: starts_at.to_string(),
                ends_at: ends_at.to_string(),
                time_zone: "Asia/Tokyo".to_string(),
            },
        }
    }

    #[test]
    fn migrates_and_persists_calendar_events() {
        let path = test_store_path();
        let connection = open_store(&path).unwrap();
        let version: i64 = connection
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, CALENDAR_DB_VERSION);
        drop(connection);

        let created = create_calendar_event_in_store(
            &path,
            timed_input(
                "設計レビュー",
                "2026-07-11T05:00:00Z",
                "2026-07-11T06:00:00Z",
            ),
        )
        .unwrap();
        let events = list_calendar_events_from_store(
            &path,
            CalendarEventRange {
                start_instant: "2026-07-01T00:00:00Z".to_string(),
                end_instant: "2026-08-01T00:00:00Z".to_string(),
                start_date: "2026-07-01".to_string(),
                end_date_exclusive: "2026-08-01".to_string(),
            },
        )
        .unwrap();
        assert_eq!(events, vec![created.clone()]);

        let reopened = open_store(&path).unwrap();
        assert_eq!(load_event(&reopened, &created.id).unwrap(), created);
        drop(reopened);
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn updates_deletes_and_finds_the_next_event() {
        let path = test_store_path();
        let first = create_calendar_event_in_store(
            &path,
            timed_input("最初の予定", "2026-07-11T05:00:00Z", "2026-07-11T06:00:00Z"),
        )
        .unwrap();
        let second = create_calendar_event_in_store(
            &path,
            timed_input("次の予定", "2026-07-12T05:00:00Z", "2026-07-12T06:00:00Z"),
        )
        .unwrap();

        let next = get_next_calendar_event_from_store(
            &path,
            CalendarEventCursor {
                now_instant: "2026-07-11T04:00:00Z".to_string(),
                today_date: "2026-07-11".to_string(),
            },
        )
        .unwrap();
        assert_eq!(
            next.as_ref().map(|event| event.id.as_str()),
            Some(first.id.as_str())
        );

        let updated = update_calendar_event_in_store(
            &path,
            first.id.clone(),
            timed_input(
                "更新した予定",
                "2026-07-11T05:30:00Z",
                "2026-07-11T06:30:00Z",
            ),
        )
        .unwrap();
        assert_eq!(updated.title, "更新した予定");

        delete_calendar_event_in_store(&path, first.id).unwrap();
        let next = get_next_calendar_event_from_store(
            &path,
            CalendarEventCursor {
                now_instant: "2026-07-11T04:00:00Z".to_string(),
                today_date: "2026-07-11".to_string(),
            },
        )
        .unwrap();
        assert_eq!(
            next.as_ref().map(|event| event.id.as_str()),
            Some(second.id.as_str())
        );

        fs::remove_file(path).unwrap();
    }

    #[test]
    fn rejects_invalid_calendar_event_inputs() {
        let invalid_title = timed_input("   ", "2026-07-11T05:00:00Z", "2026-07-11T06:00:00Z");
        assert_eq!(
            validate_input(invalid_title).unwrap_err(),
            "Title is required."
        );

        let invalid_range = timed_input(
            "逆転した予定",
            "2026-07-11T06:00:00Z",
            "2026-07-11T05:00:00Z",
        );
        assert_eq!(
            validate_input(invalid_range).unwrap_err(),
            "endsAt must be after startsAt."
        );
    }

    #[test]
    fn migrates_v1_store_without_losing_local_events() {
        let path = test_store_path();
        let connection = Connection::open(&path).unwrap();
        connection
            .execute_batch(
                "CREATE TABLE calendar_events (
               id TEXT PRIMARY KEY NOT NULL,title TEXT NOT NULL,notes TEXT NOT NULL,
               schedule_kind TEXT NOT NULL,start_date TEXT,end_date_exclusive TEXT,
               starts_at TEXT,ends_at TEXT,time_zone TEXT,source_kind TEXT NOT NULL,
               created_at TEXT NOT NULL,updated_at TEXT NOT NULL
             );
             INSERT INTO calendar_events VALUES(
               'legacy','以前の予定','','allDay','2026-07-11','2026-07-12',NULL,NULL,NULL,
               'local','2026-07-01T00:00:00.000Z','2026-07-01T00:00:00.000Z'
             );
             PRAGMA user_version=1;",
            )
            .unwrap();
        drop(connection);

        let migrated = open_store(&path).unwrap();
        let event = load_event(&migrated, "legacy").unwrap();
        assert_eq!(event.title, "以前の予定");
        assert_eq!(event.source, CalendarEventSource::Local);
        assert_eq!(
            migrated
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .unwrap(),
            2
        );
        drop(migrated);
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn replaces_pending_update_with_latest_payload() {
        let path = test_store_path();
        let event = create_calendar_event_in_store(
            &path,
            timed_input("同期前", "2026-07-11T05:00:00Z", "2026-07-11T06:00:00Z"),
        )
        .unwrap();
        queue_google_operation(&path, "primary", &event, "create").unwrap();
        let updated = update_calendar_event_in_store(
            &path,
            event.id,
            timed_input("同期後", "2026-07-11T05:30:00Z", "2026-07-11T06:30:00Z"),
        )
        .unwrap();
        queue_google_operation(&path, "primary", &updated, "create").unwrap();

        let connection = open_store(&path).unwrap();
        let (count, payload): (i64, String) = connection
            .query_row(
                "SELECT COUNT(*),payload FROM calendar_outbox WHERE event_id=?1",
                [&updated.id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(count, 1);
        assert!(payload.contains("同期後"));
        drop(connection);
        fs::remove_file(path).unwrap();
    }
}
