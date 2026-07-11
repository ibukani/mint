use std::time::{Duration, Instant};

pub(super) fn interval_elapsed(
    previous: Option<Instant>,
    now: Instant,
    interval: Duration,
) -> bool {
    previous.is_none_or(|previous| now.duration_since(previous) >= interval)
}
