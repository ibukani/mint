use super::debounce::interval_elapsed;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition};

use crate::core::window::{ensure_overlay_window, OverlayTarget};

pub(super) const TOGGLE_DEBOUNCE: Duration = Duration::from_millis(250);
static LAST_TOGGLE: OnceLock<Mutex<Option<Instant>>> = OnceLock::new();

pub fn toggle_game_launcher_overlay(app: &AppHandle) {
    if !accept_toggle(Instant::now()) {
        return;
    }
    let enabled = crate::core::settings::load_settings_cached(app)
        .map(|settings| settings.game_launcher.enabled)
        .unwrap_or(false);
    if !enabled {
        return;
    }
    if app.get_webview_window("gameLauncher").is_none() {
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            if ensure_overlay_window(&app, OverlayTarget::GameLauncher).is_ok() {
                toggle_game_launcher_overlay_ready(&app);
            }
        });
        return;
    }
    toggle_game_launcher_overlay_ready(app);
}

fn toggle_game_launcher_overlay_ready(app: &AppHandle) {
    let Ok(window) = ensure_overlay_window(app, OverlayTarget::GameLauncher) else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.emit("game-launcher-hide-requested", ());
        return;
    }
    show_game_launcher_overlay(app);
}

pub fn show_game_launcher_overlay(app: &AppHandle) {
    let Ok(window) = ensure_overlay_window(app, OverlayTarget::GameLauncher) else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        return;
    }
    if let Ok(Some(monitor)) = window.current_monitor().or_else(|_| app.primary_monitor()) {
        let size = window
            .outer_size()
            .unwrap_or(tauri::PhysicalSize::new(760, 520));
        let monitor_size = monitor.size();
        let x = monitor.position().x + (monitor_size.width.saturating_sub(size.width) / 2) as i32;
        let y = monitor.position().y + (monitor_size.height.saturating_sub(size.height) / 2) as i32;
        let _ = window.set_position(tauri::Position::Physical(PhysicalPosition::new(x, y)));
    }
    if crate::core::window::is_initial_show_pending("gameLauncher") {
        return;
    }
    let _ = window.show();
    let _ = window.set_always_on_top(true);
    let _ = window.set_focus();
    let _ = window.emit("game-launcher-shown", ());
}

fn accept_toggle(now: Instant) -> bool {
    let mut last = LAST_TOGGLE
        .get_or_init(|| Mutex::new(None))
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if !toggle_allowed(*last, now) {
        return false;
    }
    *last = Some(now);
    true
}

pub(super) fn toggle_allowed(previous: Option<Instant>, now: Instant) -> bool {
    interval_elapsed(previous, now, TOGGLE_DEBOUNCE)
}
