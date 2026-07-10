use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition};

const CALENDAR_HEIGHT: f64 = 384.0;
const WINDOW_MARGIN: f64 = 20.0;
const OVERLAY_PADDING: f64 = 8.0;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CalendarShownPayload {
    close_clock_on_toggle: bool,
    docked: bool,
}

fn position_calendar(app: &AppHandle, docked: bool, settings: &crate::core::settings::AppSettings) {
    let Some(calendar) = app.get_webview_window("calendar") else {
        return;
    };

    let percent = settings.clock.size_percent as f64 / 100.0;
    let base_w = if settings.clock.display_mode == "analog" {
        240.0
    } else {
        420.0
    };
    let calendar_width_logical = base_w * percent;

    if docked {
        if let Some(clock) = app.get_webview_window("clock") {
            if let (Ok(clock_position), Ok(clock_size), Ok(Some(monitor))) = (
                clock.outer_position(),
                clock.outer_size(),
                clock.current_monitor(),
            ) {
                let scale = monitor.scale_factor();
                // Same formula as clock.rs: (width * scale) as u32
                let physical_width = (calendar_width_logical * scale) as u32;
                let calendar_h = (CALENDAR_HEIGHT * scale).round() as u32;
                let margin = (WINDOW_MARGIN * scale) as u32;

                let _ = calendar.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(
                    physical_width,
                    calendar_h,
                )));

                let padding = (OVERLAY_PADDING * 2.0 * scale).round() as i32;
                let y = clock_position.y + clock_size.height as i32 - padding;
                let x = monitor.size().width.saturating_sub(physical_width + margin);
                let _ = calendar.set_position(tauri::Position::Physical(
                    PhysicalPosition::new(x as i32, y),
                ));
                return;
            }
        }
    }

    // Fallback: non-docked or clock not available
    let monitor = calendar
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| app.primary_monitor().ok().flatten());
    if let Some(monitor) = monitor {
        let scale = monitor.scale_factor();
        // Same conversion as clock.rs: (width * scale) as u32
        let physical_width = (calendar_width_logical * scale) as u32;
        let calendar_h = (CALENDAR_HEIGHT * scale).round() as u32;
        let margin = (WINDOW_MARGIN * scale) as u32;

        let _ = calendar.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(
            physical_width,
            calendar_h,
        )));

        let x = monitor.size().width.saturating_sub(physical_width + margin);
        let y = margin;
        let _ = calendar.set_position(tauri::Position::Physical(PhysicalPosition::new(
            x as i32, y as i32,
        )));
    }
}

pub fn toggle_calendar_overlay(app: &AppHandle) {
    let settings = match crate::core::settings::load_settings_internal(app) {
        Ok(settings) if settings.calendar.enabled => settings,
        _ => return,
    };
    let Some(calendar) = app.get_webview_window("calendar") else {
        return;
    };

    if calendar.is_visible().unwrap_or(false) {
        let _ = calendar.emit("calendar-hide-requested", ());
        return;
    }

    let clock_was_visible = app
        .get_webview_window("clock")
        .and_then(|clock| clock.is_visible().ok())
        .unwrap_or(false);
    let should_show_clock = settings.clock.enabled && !clock_was_visible;

    if should_show_clock {
        crate::features::clock::show_clock_overlay(app, &settings);
    }

    let docked = settings.clock.enabled
        && app
            .get_webview_window("clock")
            .and_then(|clock| clock.is_visible().ok())
            .unwrap_or(false);
    position_calendar(app, docked, &settings);

    let _ = calendar.show();
    let _ = calendar.set_always_on_top(true);
    let _ = calendar.emit(
        "calendar-shown",
        CalendarShownPayload {
            close_clock_on_toggle: should_show_clock,
            docked,
        },
    );

    if docked {
        if let Some(clock) = app.get_webview_window("clock") {
            let _ = clock.emit("calendar-opened", ());
        }
    }
}
