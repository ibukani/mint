use super::models::FileShelfWindowState;
use super::{COLLAPSED_HEIGHT, COLLAPSED_WIDTH, EXPANDED_HEIGHT, EXPANDED_WIDTH};
use crate::core::settings::{FileShelfEdge, FileShelfSettings, FileShelfVerticalPosition};
use crate::core::window::{ensure_overlay_window, OverlayTarget};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition};

pub(super) fn set_window_mode(
    app: &AppHandle,
    settings: &FileShelfSettings,
    expanded: bool,
    focus: bool,
) -> Result<(), String> {
    let window = ensure_overlay_window(app, OverlayTarget::FileShelf)?;

    let (width, height) = if expanded {
        (EXPANDED_WIDTH, EXPANDED_HEIGHT)
    } else {
        (COLLAPSED_WIDTH, COLLAPSED_HEIGHT)
    };
    let cursor_position = if settings.vertical_position == FileShelfVerticalPosition::Cursor {
        app.cursor_position().ok()
    } else {
        None
    };
    let monitor = cursor_position
        .as_ref()
        .and_then(|position| {
            app.monitor_from_point(position.x, position.y)
                .ok()
                .flatten()
        })
        .or_else(|| window.current_monitor().ok().flatten())
        .or_else(|| app.primary_monitor().ok().flatten());

    // 明示的に影を無効化（ウィンドウ境界が不透明な灰色で残るバグの対策）
    let _ = window.set_shadow(false);

    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize::new(width, height)))
        .map_err(|error| error.to_string())?;

    if let Some(monitor) = monitor {
        let scale = monitor.scale_factor();
        let physical_width = (width * scale).round() as i32;
        let physical_height = (height * scale).round() as i32;
        let monitor_position = monitor.position();
        let monitor_size = monitor.size();
        let x = if settings.edge == FileShelfEdge::Left {
            monitor_position.x
        } else {
            monitor_position.x + monitor_size.width as i32 - physical_width
        };
        let available_height = (monitor_size.height as i32 - physical_height).max(0);
        let cursor_y = cursor_position
            .as_ref()
            .map(|position| position.y.round() as i32 - monitor_position.y);
        let y = monitor_position.y
            + shelf_vertical_offset(
                &settings.vertical_position,
                available_height,
                cursor_y,
                physical_height,
            );
        window
            .set_position(tauri::Position::Physical(PhysicalPosition::new(x, y)))
            .map_err(|error| error.to_string())?;
    }
    if !crate::core::window::is_initial_show_pending("fileShelf") {
        window.show().map_err(|error| error.to_string())?;
        window
            .set_always_on_top(true)
            .map_err(|error| error.to_string())?;
        if focus && expanded {
            window.set_focus().map_err(|error| error.to_string())?;
        }
    }
    if let Some(state) = app.try_state::<FileShelfWindowState>() {
        *state.0.lock().unwrap_or_else(|value| value.into_inner()) = expanded;
    }
    let _ = window.emit("file-shelf-mode-changed", expanded);
    Ok(())
}

pub fn show_file_shelf_overlay(
    app: &AppHandle,
    settings: &FileShelfSettings,
) -> Result<(), String> {
    let expanded = app
        .try_state::<FileShelfWindowState>()
        .and_then(|state| state.0.lock().ok().map(|value| *value))
        .unwrap_or(false);
    set_window_mode(app, settings, expanded, true)
}

pub(super) fn shelf_vertical_offset(
    position: &FileShelfVerticalPosition,
    available_height: i32,
    cursor_y: Option<i32>,
    shelf_height: i32,
) -> i32 {
    match position {
        FileShelfVerticalPosition::Top => 0,
        FileShelfVerticalPosition::Center => available_height / 2,
        FileShelfVerticalPosition::Bottom => available_height,
        FileShelfVerticalPosition::Cursor => cursor_y
            .map(|value| value - shelf_height / 2)
            .unwrap_or(available_height / 2)
            .clamp(0, available_height),
    }
}

pub fn apply_window_settings(app: &AppHandle, settings: &FileShelfSettings) {
    if !settings.enabled {
        if let Some(window) = app.get_webview_window("fileShelf") {
            let _ = window.hide();
        }
        if let Some(state) = app.try_state::<FileShelfWindowState>() {
            *state.0.lock().unwrap_or_else(|value| value.into_inner()) = false;
        }
        return;
    }
    let expanded = app
        .try_state::<FileShelfWindowState>()
        .and_then(|state| state.0.lock().ok().map(|value| *value))
        .unwrap_or(false);
    if expanded || settings.edge_handle_enabled {
        if app.get_webview_window("fileShelf").is_none() {
            let app = app.clone();
            let settings = settings.clone();
            tauri::async_runtime::spawn(async move {
                if ensure_overlay_window(&app, OverlayTarget::FileShelf).is_ok() {
                    let _ = set_window_mode(&app, &settings, expanded, false);
                }
            });
        } else {
            let _ = set_window_mode(app, settings, expanded, false);
        }
    } else if let Some(window) = app.get_webview_window("fileShelf") {
        let _ = window.hide();
    }
}

pub fn toggle_file_shelf_overlay(app: &AppHandle) {
    let settings = match crate::core::settings::load_settings_cached(app) {
        Ok(settings) if settings.file_shelf.enabled => settings.file_shelf,
        _ => return,
    };
    let expanded = app
        .try_state::<FileShelfWindowState>()
        .and_then(|state| state.0.lock().ok().map(|value| *value))
        .unwrap_or(false);
    if expanded {
        if settings.edge_handle_enabled {
            let _ = set_window_mode(app, &settings, false, false);
        } else if let Some(window) = app.get_webview_window("fileShelf") {
            let _ = window.hide();
            if let Some(state) = app.try_state::<FileShelfWindowState>() {
                *state.0.lock().unwrap_or_else(|value| value.into_inner()) = false;
            }
        }
    } else {
        if app.get_webview_window("fileShelf").is_none() {
            let app = app.clone();
            tauri::async_runtime::spawn(async move {
                let _ = set_window_mode(&app, &settings, true, true);
            });
        } else {
            let _ = set_window_mode(app, &settings, true, true);
        }
    }
}
