use tauri::{AppHandle, Manager};

/// Toggles the clock overlay window visibility.
pub fn toggle_clock_overlay(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("clock") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}
