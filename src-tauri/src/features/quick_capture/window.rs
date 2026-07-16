use tauri::{AppHandle, Emitter, Manager};

use crate::core::window::{ensure_overlay_window, OverlayTarget};

pub fn toggle_quick_capture_overlay(app: &AppHandle) {
    if app.get_webview_window("quickCapture").is_none() {
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            if ensure_overlay_window(&app, OverlayTarget::QuickCapture).is_ok() {
                toggle_quick_capture_overlay_ready(&app);
            }
        });
        return;
    }
    toggle_quick_capture_overlay_ready(app);
}

fn toggle_quick_capture_overlay_ready(app: &AppHandle) {
    let Ok(window) = ensure_overlay_window(app, OverlayTarget::QuickCapture) else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.emit("quick-capture-hide-requested", ());
    } else {
        let _ = window.center();
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit("quick-capture-shown", ());
    }
}
