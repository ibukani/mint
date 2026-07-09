use tauri::{AppHandle, Emitter, Manager, PhysicalPosition};

pub fn toggle_clock_overlay(app: &AppHandle) {
    let settings = match crate::core::settings::load_settings_internal(app) {
        Ok(s) => {
            if !s.clock.enabled {
                return;
            }
            s
        }
        Err(_) => return,
    };

    if let Some(window) = app.get_webview_window("clock") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let percent = settings.clock.size_percent as f64 / 100.0;
            let w = (300.0 * percent) as u32;
            let h = (110.0 * percent) as u32;
            let size = tauri::PhysicalSize::new(w, h);
            let _ = window.set_size(tauri::Size::Physical(size));

            if let Ok(Some(monitor)) = window.current_monitor() {
                let monitor_size = monitor.size();
                let margin = 20;
                let x = monitor_size.width.saturating_sub(w + margin);
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
