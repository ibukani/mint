use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Mutex;

pub mod auth;
pub mod sync;

#[cfg(test)]
mod tests;

const API_ROOT: &str = "https://www.googleapis.com/calendar/v3";

pub struct GoogleCalendarState {
    status: Mutex<RuntimeStatus>,
    operation: Mutex<()>,
}

impl Default for GoogleCalendarState {
    fn default() -> Self {
        Self {
            status: Mutex::new(RuntimeStatus::default()),
            operation: Mutex::new(()),
        }
    }
}

#[derive(Default)]
struct RuntimeStatus {
    account_email: String,
    last_synced_at: Option<String>,
    error: Option<String>,
    syncing: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleCalendarConnection {
    connected: bool,
    account_email: String,
    last_synced_at: Option<String>,
    pending_operations: u32,
    error: Option<String>,
    syncing: bool,
}

pub(super) async fn run_blocking<T, F>(task: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|error| format!("Google Calendar background task failed: {error}"))?
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
