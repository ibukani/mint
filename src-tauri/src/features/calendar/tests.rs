use super::*;
use rusqlite::Connection;
use std::{fs, path::PathBuf};
use uuid::Uuid;

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
        CALENDAR_DB_VERSION
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

#[test]
fn migrates_v2_timestamps_to_canonical_utc() {
    let path = test_store_path();
    let connection = Connection::open(&path).unwrap();
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
               operation TEXT NOT NULL,
               payload TEXT,
               local_updated_at TEXT NOT NULL,
               attempts INTEGER NOT NULL DEFAULT 0,
               last_error TEXT
             );
             INSERT INTO calendar_events (
               id,title,notes,schedule_kind,starts_at,ends_at,time_zone,source_kind,
               source_calendar_id,source_event_id,source_etag,source_access_role,
               created_at,updated_at
             ) VALUES (
               'google:primary:event','会議','','timed',
               '2026-07-11T09:00:00+09:00','2026-07-11T10:00:00+09:00',
               'Asia/Tokyo','google','primary','event','etag','writer',
               '2026-07-10T18:00:00-07:00','2026-07-10T18:30:00-07:00'
             );
             PRAGMA user_version = 2;",
        )
        .unwrap();
    drop(connection);

    let connection = open_store(&path).unwrap();
    let stored: (String, String, String, String) = connection
        .query_row(
            "SELECT starts_at,ends_at,created_at,updated_at FROM calendar_events WHERE id='google:primary:event'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .unwrap();
    let version: i64 = connection
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .unwrap();
    assert_eq!(version, CALENDAR_DB_VERSION);
    assert_eq!(stored.0, "2026-07-11T00:00:00.000Z");
    assert_eq!(stored.1, "2026-07-11T01:00:00.000Z");
    assert_eq!(stored.2, "2026-07-11T01:00:00.000Z");
    assert_eq!(stored.3, "2026-07-11T01:30:00.000Z");
    drop(connection);
    fs::remove_file(path).unwrap();
}

#[test]
fn updating_pending_google_create_replaces_the_outbox_payload() {
    let path = test_store_path();
    let event = create_calendar_event_with_sync_target(
        &path,
        timed_input("同期前", "2026-07-11T05:00:00Z", "2026-07-11T06:00:00Z"),
        Some("primary"),
    )
    .unwrap();

    let updated = update_calendar_event_with_sync(
        &path,
        event.id,
        timed_input("同期後", "2026-07-11T05:30:00Z", "2026-07-11T06:30:00Z"),
    )
    .unwrap();

    let connection = open_store(&path).unwrap();
    let (count, operation, payload): (i64, String, String) = connection
        .query_row(
            "SELECT COUNT(*),operation,payload FROM calendar_outbox WHERE event_id=?1",
            [&updated.id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .unwrap();
    assert_eq!(count, 1);
    assert_eq!(operation, "create");
    assert!(payload.contains("同期後"));
    assert!(!payload.contains("同期前"));
    drop(connection);
    fs::remove_file(path).unwrap();
}

#[test]
fn deleting_pending_google_create_removes_the_outbox_entry() {
    let path = test_store_path();
    let event = create_calendar_event_with_sync_target(
        &path,
        timed_input("削除予定", "2026-07-11T05:00:00Z", "2026-07-11T06:00:00Z"),
        Some("primary"),
    )
    .unwrap();

    delete_calendar_event_with_sync(&path, event.id.clone()).unwrap();

    let connection = open_store(&path).unwrap();
    let event_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM calendar_events WHERE id=?1",
            [&event.id],
            |row| row.get(0),
        )
        .unwrap();
    let outbox_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM calendar_outbox WHERE event_id=?1",
            [&event.id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(event_count, 0);
    assert_eq!(outbox_count, 0);
    drop(connection);
    fs::remove_file(path).unwrap();
}
