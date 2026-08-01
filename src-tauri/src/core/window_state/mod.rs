pub mod model;
pub mod policy;
pub mod repository;
pub mod restore;

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

use super::window::ensure_window_allowed;
use policy::policy_for;

pub const WINDOW_STATE_VERSION: u32 = 1;

/// Debounce window for position/size persistence events.
const PERSIST_DEBOUNCE_MS: u64 = 500;

static LAST_WINDOW_EVENT: OnceLock<Mutex<HashMap<String, Instant>>> = OnceLock::new();

fn last_window_event() -> &'static Mutex<HashMap<String, Instant>> {
    LAST_WINDOW_EVENT.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Schedules a debounced persistence of the window's position/size.
///
/// Call from `WindowEvent::Moved` / `WindowEvent::Resized` handlers.
pub fn maybe_persist(app: &AppHandle, label: &str) {
    if !policy::is_persisted(label) {
        return;
    }
    let now = Instant::now();
    last_window_event()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .insert(label.to_string(), now);

    let app = app.clone();
    let label = label.to_string();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(PERSIST_DEBOUNCE_MS));
        let is_latest = last_window_event()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .get(&label)
            .is_some_and(|stored| *stored == now);
        if is_latest {
            let _ = persist_now(&app, &label);
        }
    });
}

/// Persists the window's current position/size immediately (flush).
///
/// Returns `Ok(false)` when the window has no policy or no longer exists.
pub fn persist_now(app: &AppHandle, label: &str) -> Result<bool, String> {
    let Some(policy) = policy_for(label) else {
        return Ok(false);
    };
    let Some(window) = app.get_webview_window(label) else {
        return Ok(false);
    };
    let state = model::PersistedWindowState::capture(&window)?;
    if !policy.persist_position && !policy.persist_size {
        return Ok(false);
    }
    let dir = repository::window_state_dir(app)?;
    repository::save(&dir, label, &state)
        .map_err(|error| format!("ウィンドウ状態を保存できませんでした: {error}"))?;
    Ok(true)
}

/// Persists all window states that have a policy (used on app exit).
pub fn flush_all(app: &AppHandle) {
    for policy in policy::WINDOW_POLICIES {
        let _ = persist_now(app, policy.label);
    }
}

/// Deletes the persisted state for the given window so the next show uses the
/// default placement. Only callable from the main window.
#[tauri::command]
pub fn reset_window_state(
    app: AppHandle,
    window: tauri::WebviewWindow,
    label: String,
) -> Result<(), String> {
    ensure_window_allowed(&window, &["main"])?;
    if policy_for(&label).is_none() {
        return Err(format!("未知のウィンドウラベルです: {label}"));
    }
    let dir = repository::window_state_dir(&app)?;
    repository::delete(&dir, &label)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn policy_for_allows_reset_targets() {
        for label in [
            "main",
            "quickCapture",
            "gameLauncher",
            "calendar",
            "calendarEditor",
        ] {
            assert!(policy_for(label).is_some(), "{label} should have a policy");
        }
    }
}
