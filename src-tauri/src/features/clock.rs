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
            let (base_w, base_h) = if settings.clock.display_mode == "analog" {
                (
                    240.0,
                    if settings.clock.show_date {
                        250.0
                    } else {
                        190.0
                    },
                )
            } else {
                (
                    420.0,
                    if settings.clock.show_date {
                        168.0
                    } else {
                        132.0
                    },
                )
            };
            let w = base_w * percent;
            let h = base_h * percent;
            let size = tauri::LogicalSize::new(w, h);
            let _ = window.set_size(tauri::Size::Logical(size));

            if let Ok(Some(monitor)) = window.current_monitor() {
                let monitor_size = monitor.size();
                let scale_factor = monitor.scale_factor();
                let physical_w = (w * scale_factor) as u32;
                let margin = (20.0 * scale_factor) as u32;
                let x = monitor_size.width.saturating_sub(physical_w + margin);
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
