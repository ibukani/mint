use tauri::{AppHandle, Emitter, Manager, PhysicalPosition};

/// Toggles the clock overlay window visibility.
pub fn toggle_clock_overlay(app: &AppHandle) {
    if let Ok(settings) = crate::core::settings::load_settings_internal(app) {
        if !settings.clock.enabled {
            return;
        }
    }

    if let Some(window) = app.get_webview_window("clock") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            if let Ok(Some(monitor)) = window.current_monitor() {
                let monitor_size = monitor.size();
                let window_size = window
                    .outer_size()
                    .unwrap_or(tauri::PhysicalSize::new(300, 110));
                let margin = 20;
                let x = monitor_size
                    .width
                    .saturating_sub(window_size.width + margin);
                let y = margin;
                let _ = window.set_position(tauri::Position::Physical(PhysicalPosition::new(
                    x as i32, y as i32,
                )));
            }
            let _ = window.show();
            let _ = window.set_always_on_top(true);
            let _ = window.emit("clock-shown", ());
        }
    }
}
