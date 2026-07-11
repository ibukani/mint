use super::{sync::upsert_event, EventDateTime, GoogleEvent};
use rusqlite::Connection;

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
