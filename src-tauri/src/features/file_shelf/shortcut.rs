use std::time::{Duration as StdDuration, Instant};

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::ShortcutState;

use crate::core::settings::{AppSettings, AppSettingsState, FileShelfSettings};

use super::clipboard::{
    capture_current_clipboard, foreground_application_name, is_application_ignored,
};
use super::models::{FileShelfShortcutState, FileShelfStoreState, FileShelfWindowState};
use super::repository::restore_recent_removal_in_store;
use super::window::{set_window_mode, toggle_file_shelf_overlay};

pub(super) const SHORTCUT_DOUBLE_PRESS_INTERVAL: StdDuration = StdDuration::from_millis(550);
pub(super) const SHORTCUT_LONG_PRESS_INTERVAL: StdDuration = StdDuration::from_millis(800);

pub(super) fn is_double_shortcut_press(previous: &mut Option<Instant>, now: Instant) -> bool {
    if previous
        .take()
        .and_then(|value| now.checked_duration_since(value))
        .is_some_and(|elapsed| elapsed <= SHORTCUT_DOUBLE_PRESS_INTERVAL)
    {
        true
    } else {
        *previous = Some(now);
        false
    }
}

pub(super) fn shortcut_hold_duration(
    pressed_at: &mut Option<Instant>,
    now: Instant,
) -> Option<StdDuration> {
    pressed_at
        .take()
        .and_then(|value| now.checked_duration_since(value))
}

pub fn handle_file_shelf_shortcut_event(
    app: &AppHandle,
    settings: &FileShelfSettings,
    shortcut_state: ShortcutState,
) {
    let now = Instant::now();
    if shortcut_state == ShortcutState::Pressed {
        let double_pressed = app
            .try_state::<FileShelfShortcutState>()
            .and_then(|state| {
                state.0.lock().ok().map(|mut timing| {
                    timing.current_pressed_at = Some(now);
                    is_double_shortcut_press(&mut timing.last_pressed_at, now)
                })
            })
            .unwrap_or(false);
        if !double_pressed {
            toggle_file_shelf_overlay(app);
            return;
        }

        let app = app.clone();
        let settings = settings.clone();
        let _ = std::thread::Builder::new()
            .name("mint-file-shelf-shortcut-capture".to_string())
            .spawn(move || {
                match capture_current_clipboard(&app) {
                    Ok(mutation) => {
                        let notice = if mutation.added_count > 0 {
                            "クリップボードから棚へ保存しました"
                        } else {
                            "同じ内容はすでに棚にあります"
                        };
                        let _ = app.emit("file-shelf-state-changed", mutation.state);
                        let _ = app.emit("file-shelf-notice", notice);
                    }
                    Err(error) => {
                        let _ = app.emit("file-shelf-error", error);
                    }
                }
                let _ = set_window_mode(&app, &settings, true, true);
            });
        return;
    }

    let long_pressed = app
        .try_state::<FileShelfShortcutState>()
        .and_then(|state| {
            state.0.lock().ok().map(|mut timing| {
                let duration = shortcut_hold_duration(&mut timing.current_pressed_at, now);
                let long_pressed =
                    duration.is_some_and(|value| value >= SHORTCUT_LONG_PRESS_INTERVAL);
                if long_pressed {
                    timing.last_pressed_at = None;
                }
                long_pressed
            })
        })
        .unwrap_or(false);
    if !long_pressed {
        return;
    }

    let app = app.clone();
    let settings = settings.clone();
    let _ = std::thread::Builder::new()
        .name("mint-file-shelf-shortcut-restore".to_string())
        .spawn(move || {
            let result = app
                .try_state::<FileShelfStoreState>()
                .ok_or_else(|| "ファイルシェルの保存先を準備できていません。".to_string())
                .and_then(|store| restore_recent_removal_in_store(&store.path));
            match result {
                Ok(state) => {
                    let _ = app.emit("file-shelf-state-changed", state);
                    let _ = app.emit("file-shelf-recent-removal-restored", ());
                    let _ = app.emit("file-shelf-notice", "最近外した項目を棚へ戻しました");
                }
                Err(error) => {
                    let _ = app.emit("file-shelf-error", error);
                }
            }
            let _ = set_window_mode(&app, &settings, true, true);
        });
}

pub(super) fn should_auto_expand_file_shelf(app: AppHandle) -> Result<bool, String> {
    let settings = app
        .try_state::<AppSettingsState>()
        .and_then(|state| state.0.lock().ok().and_then(|value| value.clone()))
        .map(Ok)
        .unwrap_or_else(|| crate::core::settings::load_settings_internal(&app))?;
    Ok(settings.file_shelf.enabled
        && !is_application_ignored(
            &settings.file_shelf,
            foreground_application_name().as_deref(),
        ))
}

pub(super) fn set_file_shelf_expanded(
    app: AppHandle,
    expanded: bool,
    focus: bool,
) -> Result<(), String> {
    let settings: AppSettings = crate::core::settings::load_settings_cached(&app)?;
    if !settings.file_shelf.enabled {
        return Err("ファイルシェルは無効です。".to_string());
    }
    if !expanded && !settings.file_shelf.edge_handle_enabled {
        if let Some(window) = app.get_webview_window("fileShelf") {
            window.hide().map_err(|error| error.to_string())?;
        }
        if let Some(state) = app.try_state::<FileShelfWindowState>() {
            *state.0.lock().unwrap_or_else(|value| value.into_inner()) = false;
        }
        return Ok(());
    }
    set_window_mode(&app, &settings.file_shelf, expanded, focus && expanded)
}
