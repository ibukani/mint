use super::{CalendarEventInput, CalendarEventSchedule};
use chrono::{DateTime, NaiveDate, SecondsFormat, Utc};

pub(super) fn validate_date(value: &str, label: &str) -> Result<NaiveDate, String> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|_| format!("{label} must use YYYY-MM-DD format."))
}

pub(super) fn validate_instant(
    value: &str,
    label: &str,
) -> Result<DateTime<chrono::FixedOffset>, String> {
    DateTime::parse_from_rfc3339(value)
        .map_err(|_| format!("{label} must be an RFC 3339 timestamp."))
}

pub(super) fn validate_input(mut input: CalendarEventInput) -> Result<CalendarEventInput, String> {
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

pub(super) fn schedule_columns(schedule: &CalendarEventSchedule) -> ScheduleColumns<'_> {
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
