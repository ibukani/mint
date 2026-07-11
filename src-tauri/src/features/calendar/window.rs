use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition};

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
    let Some(calendar) = app.get_webview_window("calendar") else {
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
    match crate::core::settings::load_settings_internal(app) {
        Ok(settings) if settings.calendar.enabled => {}
        _ => return,
    };

    // Use the command to open it with default empty payload (needs State inside Tauri, so we retrieve it or pass None)
    if let Some(state) = app.try_state::<CalendarEditorState>() {
        open_calendar_editor_window(app.clone(), state, None);
    }
}

#[tauri::command]
pub fn get_calendar_editor_payload(
    state: tauri::State<'_, CalendarEditorState>,
) -> Option<CalendarEditorPayload> {
    state.0.lock().ok().and_then(|guard| guard.clone())
}

#[tauri::command]
pub fn open_calendar_editor_window(
    app: tauri::AppHandle,
    state: tauri::State<'_, CalendarEditorState>,
    payload: Option<CalendarEditorPayload>,
) {
    let Some(editor) = app.get_webview_window("calendarEditor") else {
        return;
    };

    let payload = payload.unwrap_or_else(|| CalendarEditorPayload {
        mode: "create".to_string(),
        date: None,
        event: None,
        template: None,
    });

    if let Ok(mut guard) = state.0.lock() {
        *guard = Some(payload.clone());
    }

    if let Ok(Some(monitor)) = editor.current_monitor().or_else(|_| app.primary_monitor()) {
        let scale = monitor.scale_factor();
        let physical_width = (420.0 * scale) as u32;
        let physical_height = (640.0 * scale) as u32;
        let _ = editor.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(
            physical_width,
            physical_height,
        )));
        let _ = editor.center();
    }

    let _ = editor.show();
    let _ = editor.set_always_on_top(true);
    let _ = editor.unminimize();
    let _ = editor.set_focus();

    let _ = editor.emit("calendar-editor-shown", payload);
}

fn show_calendar_overlay(
    app: &AppHandle,
    settings: &crate::core::settings::AppSettings,
    initial_mode: CalendarOpenMode,
) {
    let Some(calendar) = app.get_webview_window("calendar") else {
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
