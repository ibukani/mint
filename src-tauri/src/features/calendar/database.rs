use super::CalendarStoreState;
use rusqlite::Connection;
use std::{fs, path::Path, time::Duration};
use tauri::{AppHandle, Manager};

pub(super) const CALENDAR_DB_VERSION: i64 = 3;

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

pub(crate) fn open_store(path: &Path) -> Result<Connection, String> {
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
                 PRAGMA user_version = 3;
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
                 PRAGMA user_version = 3;
                 COMMIT;",
            )
            .map_err(|error| error.to_string()),
        2 => connection
            .execute_batch(
                "BEGIN;
                 UPDATE calendar_events SET
                   starts_at = COALESCE(strftime('%Y-%m-%dT%H:%M:%fZ', starts_at), starts_at),
                   ends_at = COALESCE(strftime('%Y-%m-%dT%H:%M:%fZ', ends_at), ends_at),
                   created_at = COALESCE(strftime('%Y-%m-%dT%H:%M:%fZ', created_at), created_at),
                   updated_at = COALESCE(strftime('%Y-%m-%dT%H:%M:%fZ', updated_at), updated_at);
                 PRAGMA user_version = 3;
                 COMMIT;",
            )
            .map_err(|error| error.to_string()),
        CALENDAR_DB_VERSION => Ok(()),
        _ => Err(format!("Unsupported calendar database version: {version}")),
    }
}
