use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

pub mod database;
pub mod repository;
pub mod validation;
pub mod window;

pub use database::initialize_store;
pub use window::{open_calendar_event_editor, position_calendar, toggle_calendar_overlay};
pub(crate) use window::{show_calendar_editor_when_ready, show_calendar_overlay};

#[cfg(test)]
mod tests;

#[cfg(test)]
use database::{open_store, CALENDAR_DB_VERSION};
#[cfg(test)]
use repository::{
    create_calendar_event_in_store, create_calendar_event_with_sync_target,
    delete_calendar_event_in_store, delete_calendar_event_with_sync,
    get_next_calendar_event_from_store, list_calendar_events_from_store, load_event,
    queue_google_operation, update_calendar_event_in_store, update_calendar_event_with_sync,
};
#[cfg(test)]
use validation::validate_input;

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
