use tauri::{AppHandle, Emitter, Manager};

pub fn toggle_quick_capture_overlay(app: &AppHandle) {
    let Some(window) = app.get_webview_window("quickCapture") else {
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
