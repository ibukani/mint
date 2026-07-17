use tauri::{AppHandle, Emitter, Manager, PhysicalPosition};

use crate::core::window::{ensure_overlay_window, OverlayTarget};

pub fn toggle_clock_overlay(app: &AppHandle) {
    let settings = match crate::core::settings::load_settings_cached(app) {
        Ok(s) => {
            if !s.clock.enabled {
                return;
            }
            s
        }
        Err(_) => return,
    };

    if let Some(calendar) = app.get_webview_window("calendar") {
        if calendar.is_visible().unwrap_or(false) {
            let _ = calendar.emit("calendar-hide-all-requested", ());
            return;
        }
    }

    if app.get_webview_window("clock").is_none() {
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            if ensure_overlay_window(&app, OverlayTarget::Clock).is_ok() {
                toggle_clock_overlay(&app);
            }
        });
        return;
    }

    let Ok(window) = ensure_overlay_window(app, OverlayTarget::Clock) else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        show_clock_overlay(app, &settings);
    }
}

pub fn show_clock_overlay(app: &AppHandle, settings: &crate::core::settings::AppSettings) {
    if app.get_webview_window("clock").is_none() {
        let app = app.clone();
        let settings = settings.clone();
        tauri::async_runtime::spawn(async move {
            if ensure_overlay_window(&app, OverlayTarget::Clock).is_ok() {
                show_clock_overlay(&app, &settings);
            }
        });
        return;
    }

    let Ok(window) = ensure_overlay_window(app, OverlayTarget::Clock) else {
        return;
    };
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
    let width = base_w * percent;
    let height = base_h * percent;

    if let Ok(Some(monitor)) = window.current_monitor() {
        let monitor_size = monitor.size();
        let scale_factor = monitor.scale_factor();
        let physical_width = (width * scale_factor) as u32;
        let physical_height = (height * scale_factor) as u32;
        let margin = (20.0 * scale_factor) as u32;

        let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(
            physical_width,
            physical_height,
        )));

        let x = monitor_size.width.saturating_sub(physical_width + margin);
        let _ = window.set_position(tauri::Position::Physical(PhysicalPosition::new(
            x as i32,
            margin as i32,
        )));
    } else {
        // Fallback if no monitor info available
        let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize::new(width, height)));
    }

    if crate::core::window::is_initial_show_pending("clock") {
        return;
    }

    let _ = window.show();
    let _ = window.set_always_on_top(true);
    let _ = window.emit("clock-shown", ());
}
