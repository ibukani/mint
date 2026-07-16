use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition};

use crate::core::window::{ensure_overlay_window, ensure_window, OverlayTarget};

const CALENDAR_HEIGHT: f64 = 384.0;
const WINDOW_MARGIN: f64 = 20.0;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CalendarShownPayload {
    close_clock_on_toggle: bool,
    docked: bool,
    initial_mode: CalendarOpenMode,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
enum CalendarOpenMode {
    Month,
}

pub fn position_calendar(
    app: &AppHandle,
    docked: bool,
    settings: &crate::core::settings::AppSettings,
) {
    let Ok(calendar) = ensure_overlay_window(app, OverlayTarget::Calendar) else {
        return;
    };

    let percent = settings.clock.size_percent as f64 / 100.0;
    let base_w = if settings.clock.display_mode == "analog" {
        240.0
    } else {
        420.0
    };
    let content_width_logical = (base_w * percent).max(320.0);
    let calendar_width_logical = content_width_logical;
    let calendar_height_logical = CALENDAR_HEIGHT * (content_width_logical / 420.0).max(1.0);

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
                let calendar_h = (calendar_height_logical * scale).round() as u32;

                let _ = calendar.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(
                    physical_width,
                    calendar_h,
                )));

                let overlap = 0;
                let y = clock_position.y + clock_size.height as i32 - overlap;
                let x = clock_position.x + clock_size.width as i32 - physical_width as i32;
                let _ =
                    calendar.set_position(tauri::Position::Physical(PhysicalPosition::new(x, y)));
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
        let calendar_h = (calendar_height_logical * scale).round() as u32;
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
    let settings = match crate::core::settings::load_settings_cached(app) {
        Ok(settings) if settings.calendar.enabled => settings,
        _ => return,
    };
    if app.get_webview_window("calendar").is_none() {
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            if ensure_overlay_window(&app, OverlayTarget::Calendar).is_ok() {
                toggle_calendar_overlay(&app);
            }
        });
        return;
    }
    let Ok(calendar) = ensure_overlay_window(app, OverlayTarget::Calendar) else {
        return;
    };

    if calendar.is_visible().unwrap_or(false) {
        let _ = calendar.emit("calendar-hide-requested", ());
        return;
    }

    show_calendar_overlay(app, &settings, CalendarOpenMode::Month);
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEditorPayload {
    pub mode: String,
    pub date: Option<String>,
    pub event: Option<serde_json::Value>,
    pub template: Option<serde_json::Value>,
}

#[derive(Default)]
pub struct CalendarEditorState(pub std::sync::Mutex<Option<CalendarEditorPayload>>);

pub fn open_calendar_event_editor(app: &AppHandle) {
    match crate::core::settings::load_settings_cached(app) {
        Ok(settings) if settings.calendar.enabled => {}
        _ => return,
    };

    if app.get_webview_window("calendarEditor").is_none() {
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            if ensure_window(&app, "calendarEditor", "予定編集").is_ok() {
                if let Some(state) = app.try_state::<CalendarEditorState>() {
                    if let Err(error) = open_calendar_editor_window_inner(&app, &state, None) {
                        eprintln!("Failed to open calendar editor from shortcut: {error}");
                    }
                }
            }
        });
    } else if let Some(state) = app.try_state::<CalendarEditorState>() {
        if let Err(error) = open_calendar_editor_window_inner(app, &state, None) {
            eprintln!("Failed to open calendar editor from shortcut: {error}");
        }
    }
}

#[tauri::command]
pub fn get_calendar_editor_payload(
    state: tauri::State<'_, CalendarEditorState>,
) -> Option<CalendarEditorPayload> {
    state.0.lock().ok().and_then(|guard| guard.clone())
}

#[tauri::command]
pub async fn open_calendar_editor_window(
    app: tauri::AppHandle,
    state: tauri::State<'_, CalendarEditorState>,
    payload: Option<CalendarEditorPayload>,
) -> Result<(), String> {
    open_calendar_editor_window_inner(&app, &state, payload)
}

fn open_calendar_editor_window_inner(
    app: &tauri::AppHandle,
    state: &CalendarEditorState,
    payload: Option<CalendarEditorPayload>,
) -> Result<(), String> {
    let payload = payload.unwrap_or_else(|| CalendarEditorPayload {
        mode: "create".to_string(),
        date: None,
        event: None,
        template: None,
    });

    let payload_is_valid = match payload.mode.as_str() {
        "create" => true,
        "edit" => payload.event.is_some(),
        "duplicate" => payload.template.is_some(),
        _ => false,
    };
    if !payload_is_valid {
        return Err("Calendar editor payload is invalid".to_string());
    }

    let editor = ensure_window(app, "calendarEditor", "予定編集")?;

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "Calendar editor state is unavailable".to_string())?;
    *guard = Some(payload.clone());
    drop(guard);

    if let Ok(Some(monitor)) = editor.current_monitor().or_else(|_| app.primary_monitor()) {
        let scale = monitor.scale_factor();
        let physical_width = (420.0 * scale) as u32;
        let physical_height = (640.0 * scale) as u32;
        editor
            .set_size(tauri::Size::Physical(tauri::PhysicalSize::new(
                physical_width,
                physical_height,
            )))
            .map_err(|error| format!("Failed to size calendar editor window: {error}"))?;
        editor
            .center()
            .map_err(|error| format!("Failed to center calendar editor window: {error}"))?;
    }

    editor
        .show()
        .map_err(|error| format!("Failed to show calendar editor window: {error}"))?;
    editor
        .set_always_on_top(true)
        .map_err(|error| format!("Failed to keep calendar editor on top: {error}"))?;
    editor
        .unminimize()
        .map_err(|error| format!("Failed to restore calendar editor window: {error}"))?;
    editor
        .set_focus()
        .map_err(|error| format!("Failed to focus calendar editor window: {error}"))?;

    editor
        .emit("calendar-editor-shown", payload)
        .map_err(|error| format!("Failed to deliver calendar editor payload: {error}"))?;

    Ok(())
}

fn show_calendar_overlay(
    app: &AppHandle,
    settings: &crate::core::settings::AppSettings,
    initial_mode: CalendarOpenMode,
) {
    let Ok(calendar) = ensure_overlay_window(app, OverlayTarget::Calendar) else {
        return;
    };

    let clock_was_visible = app
        .get_webview_window("clock")
        .and_then(|clock| clock.is_visible().ok())
        .unwrap_or(false);
    let should_show_clock = settings.clock.enabled && !clock_was_visible;

    if should_show_clock {
        crate::features::clock::show_clock_overlay(app, settings);
    }

    let docked = settings.clock.enabled
        && app
            .get_webview_window("clock")
            .and_then(|clock| clock.is_visible().ok())
            .unwrap_or(false);
    position_calendar(app, docked, settings);

    let _ = calendar.show();
    let _ = calendar.set_always_on_top(true);
    let _ = calendar.emit(
        "calendar-shown",
        CalendarShownPayload {
            close_clock_on_toggle: should_show_clock,
            docked,
            initial_mode,
        },
    );
    let _ = calendar.set_focus();

    if docked {
        if let Some(clock) = app.get_webview_window("clock") {
            let _ = clock.emit("calendar-opened", ());
        }
    }
}
