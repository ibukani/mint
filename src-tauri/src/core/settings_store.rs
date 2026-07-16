use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

use super::settings_model::{AppSettings, AppSettingsState, SettingsError};

fn get_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app.path().app_config_dir().map_err(|e| e.to_string())?;
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }
    Ok(path.join("settings.json"))
}

fn should_enable_autostart(requested: bool, debug_build: bool) -> bool {
    requested && !debug_build
}

fn temporary_path(destination: &Path) -> Result<PathBuf, String> {
    let file_name = destination
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "設定ファイル名を取得できません。".to_string())?;
    let parent = destination.parent().unwrap_or_else(|| Path::new("."));
    Ok(parent.join(format!(".{file_name}.mint-tmp-{}", Uuid::new_v4())))
}

fn replace_file(temp_path: &Path, destination: &Path) -> Result<(), String> {
    let previous_path = temporary_path(destination)?.with_extension("previous");
    let had_previous = destination.exists();
    if had_previous {
        fs::rename(destination, &previous_path).map_err(|error| error.to_string())?;
    }

    match fs::rename(temp_path, destination) {
        Ok(()) => {
            if had_previous {
                let _ = fs::remove_file(previous_path);
            }
            Ok(())
        }
        Err(error) => {
            if had_previous {
                let _ = fs::rename(previous_path, destination);
            }
            Err(error.to_string())
        }
    }
}

fn write_settings_atomically(path: &Path, json: &str) -> Result<(), String> {
    let temp_path = temporary_path(path)?;
    let result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp_path)
            .map_err(|error| error.to_string())?;
        file.write_all(json.as_bytes())
            .map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;
        replace_file(&temp_path, path)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp_path);
    }
    result
}

fn restore_shortcuts(
    app: &AppHandle,
    old_shortcuts: &[(&str, &str)],
    new_shortcuts: &[(&str, &str)],
) {
    use tauri_plugin_global_shortcut::GlobalShortcutExt;

    let global_shortcut = app.global_shortcut();
    for (feature_id, new_shortcut) in new_shortcuts {
        let old_shortcut = old_shortcuts
            .iter()
            .find(|(old_feature_id, _)| old_feature_id == feature_id)
            .map(|(_, shortcut)| *shortcut);
        if old_shortcut != Some(*new_shortcut) {
            let _ = global_shortcut.unregister(*new_shortcut);
        }
    }
    for (feature_id, old_shortcut) in old_shortcuts {
        let new_shortcut = new_shortcuts
            .iter()
            .find(|(new_feature_id, _)| new_feature_id == feature_id)
            .map(|(_, shortcut)| *shortcut);
        if new_shortcut != Some(*old_shortcut) {
            let _ = global_shortcut.register(*old_shortcut);
        }
    }
}

fn file_shelf_window_settings_changed(
    old_settings: Option<&AppSettings>,
    new_settings: &AppSettings,
) -> bool {
    let Some(old_settings) = old_settings else {
        return true;
    };
    let old = &old_settings.file_shelf;
    let new = &new_settings.file_shelf;
    old.enabled != new.enabled
        || old.edge != new.edge
        || old.vertical_position != new.vertical_position
        || old.edge_handle_enabled != new.edge_handle_enabled
}

fn clipboard_history_settings_changed(
    old_settings: Option<&AppSettings>,
    new_settings: &AppSettings,
) -> bool {
    let Some(old_settings) = old_settings else {
        return true;
    };
    let old = &old_settings.file_shelf;
    let new = &new_settings.file_shelf;
    old.clipboard_history_enabled != new.clipboard_history_enabled
        || old.clipboard_history_limit != new.clipboard_history_limit
}

fn clock_layout_settings_changed(
    old_settings: Option<&AppSettings>,
    new_settings: &AppSettings,
) -> bool {
    let Some(old_settings) = old_settings else {
        return true;
    };
    let old = &old_settings.clock;
    let new = &new_settings.clock;
    old.enabled != new.enabled
        || old.show_date != new.show_date
        || old.size_percent != new.size_percent
        || old.display_mode != new.display_mode
}

/// Synchronize the OS auto-start entry with the saved preference.
///
/// A development Tauri binary loads its UI from `devUrl` (`localhost:1420`).
/// Registering that binary in Windows startup would launch it after reboot
/// without the Vite server and display a connection-refused page. Development
/// builds therefore always remove the entry, which also cleans up entries
/// created by older development sessions.
pub fn sync_autostart(app: &AppHandle, requested: bool) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;

    let desired_state = should_enable_autostart(requested, cfg!(debug_assertions));
    if desired_state {
        // Always write the current executable path. This replaces a stale
        // development executable when the user first launches a release build.
        return app
            .autolaunch()
            .enable()
            .map_err(|error| format!("自動起動設定の更新に失敗しました: {error}"));
    }

    let current_state = app
        .autolaunch()
        .is_enabled()
        .map_err(|error| format!("自動起動設定の状態確認に失敗しました: {error}"))?;
    if !current_state {
        return Ok(());
    }

    app.autolaunch()
        .disable()
        .map_err(|error| format!("自動起動設定の更新に失敗しました: {error}"))
}

/// Internal function for loading settings (used by setup and command).
pub fn load_settings_internal(app: &AppHandle) -> Result<AppSettings, String> {
    let path = get_config_path(app)?;
    if !path.exists() {
        let defaults = AppSettings::default();
        let json = serde_json::to_string_pretty(&defaults).map_err(|e| e.to_string())?;
        write_settings_atomically(&path, &json)?;
        return Ok(defaults);
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let settings: AppSettings = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(settings)
}

pub fn load_settings(
    app: AppHandle,
    state: tauri::State<'_, AppSettingsState>,
) -> Result<AppSettings, String> {
    if let Some(cached) = state.0.lock().unwrap().clone() {
        return Ok(cached);
    }
    let settings = load_settings_internal(&app)?;
    *state.0.lock().unwrap() = Some(settings.clone());
    Ok(settings)
}

/// Load settings from the process cache for backend paths that do not receive
/// `tauri::State` through an invoke command (shortcuts and window helpers).
pub fn load_settings_cached(app: &AppHandle) -> Result<AppSettings, String> {
    if let Some(state) = app.try_state::<AppSettingsState>() {
        if let Some(cached) = state
            .0
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clone()
        {
            return Ok(cached);
        }

        let settings = load_settings_internal(app)?;
        *state.0.lock().unwrap_or_else(|error| error.into_inner()) = Some(settings.clone());
        return Ok(settings);
    }

    load_settings_internal(app)
}

pub fn save_settings(
    app: AppHandle,
    settings: AppSettings,
    state: tauri::State<'_, AppSettingsState>,
) -> Result<(), String> {
    // Hold the in-memory cache lock for the entire save operation so that
    // concurrent calls cannot interleave OS side effects or file writes.
    // Recover from a poisoned mutex so a previous panic does not permanently
    // block future saves.
    let mut cached = state.0.lock().unwrap_or_else(|error| {
        eprintln!("Warning: settings mutex was poisoned, recovering to continue save");
        error.into_inner()
    });

    let new_shortcuts = settings.active_shortcuts();
    let mut seen: HashMap<&str, &str> = HashMap::new();
    let mut duplicates = Vec::new();
    for (feature_id, shortcut) in &new_shortcuts {
        if let Some(existing_feature_id) = seen.get(*shortcut) {
            duplicates.push(existing_feature_id.to_string());
            duplicates.push(feature_id.to_string());
        } else {
            seen.insert(*shortcut, *feature_id);
        }
    }
    if !duplicates.is_empty() {
        duplicates.sort();
        duplicates.dedup();
        return Err(SettingsError::DuplicateShortcut {
            features: duplicates,
        }
        .to_string());
    }

    // Read the previous settings from the in-memory cache when available;
    // otherwise fall back to disk. This guarantees the rollback baseline
    // matches the state we are about to replace.
    let old_settings = cached.clone().or_else(|| load_settings_internal(&app).ok());
    let old_autostart = old_settings.as_ref().is_some_and(|old| old.autostart);
    let old_shortcuts = old_settings
        .as_ref()
        .map(AppSettings::active_shortcuts)
        .unwrap_or_default();
    let autostart_changed = old_settings
        .as_ref()
        .is_none_or(|old| old.autostart != settings.autostart);
    let shortcuts_changed = old_settings.is_none() || old_shortcuts != new_shortcuts;
    let file_shelf_window_changed =
        file_shelf_window_settings_changed(old_settings.as_ref(), &settings);
    let clipboard_history_changed =
        clipboard_history_settings_changed(old_settings.as_ref(), &settings);
    let clock_layout_changed = clock_layout_settings_changed(old_settings.as_ref(), &settings);
    let path = get_config_path(&app)?;
    let json = serde_json::to_string_pretty(&settings).map_err(|error| {
        SettingsError::IoError {
            message: error.to_string(),
        }
        .to_string()
    })?;

    if autostart_changed {
        sync_autostart(&app, settings.autostart)
            .map_err(|message| SettingsError::AutostartError { message }.to_string())?;
    }

    if shortcuts_changed {
        use tauri_plugin_global_shortcut::GlobalShortcutExt;
        let global_shortcut = app.global_shortcut();

        for (feature_id, old_shortcut) in &old_shortcuts {
            let new_shortcut = new_shortcuts
                .iter()
                .find(|(new_feature_id, _)| new_feature_id == feature_id)
                .map(|(_, shortcut)| *shortcut);
            if new_shortcut != Some(old_shortcut) {
                let _ = global_shortcut.unregister(*old_shortcut);
            }
        }

        let mut successfully_registered = Vec::new();
        for (feature_id, new_shortcut) in &new_shortcuts {
            let old_shortcut = old_shortcuts
                .iter()
                .find(|(old_feature_id, _)| old_feature_id == feature_id)
                .map(|(_, shortcut)| *shortcut);
            if Some(*new_shortcut) == old_shortcut {
                continue;
            }

            if let Err(error) = global_shortcut.register(*new_shortcut) {
                for shortcut in successfully_registered {
                    let _ = global_shortcut.unregister(shortcut);
                }
                for (old_feature_id, old_shortcut) in &old_shortcuts {
                    let new_shortcut = new_shortcuts
                        .iter()
                        .find(|(new_feature_id, _)| new_feature_id == old_feature_id)
                        .map(|(_, shortcut)| *shortcut);
                    if new_shortcut != Some(old_shortcut) {
                        let _ = global_shortcut.register(*old_shortcut);
                    }
                }
                let _ = sync_autostart(&app, old_autostart);
                return Err(SettingsError::RegistrationFailed {
                    feature: feature_id.to_string(),
                    message: error.to_string(),
                }
                .to_string());
            }
            successfully_registered.push(*new_shortcut);
        }
    }

    if let Err(error) = write_settings_atomically(&path, &json) {
        restore_shortcuts(&app, &old_shortcuts, &new_shortcuts);
        let _ = sync_autostart(&app, old_autostart);
        return Err(SettingsError::IoError { message: error }.to_string());
    }

    *cached = Some(settings.clone());
    drop(cached);
    // Send the already validated, cached settings with the event so every
    // WebView can update without issuing a second load_settings IPC call.
    let _ = app.emit("settings-changed", &settings);

    if file_shelf_window_changed {
        crate::features::file_shelf::apply_window_settings(&app, &settings.file_shelf);
    }
    if clipboard_history_changed {
        crate::features::file_shelf::apply_clipboard_history_settings(&app, &settings.file_shelf);
    }

    if clock_layout_changed {
        if let Some(clock_window) = app.get_webview_window("clock") {
            if clock_window.is_visible().unwrap_or(false) {
                crate::features::clock::show_clock_overlay(&app, &settings);
            }
        }
        if let Some(calendar_window) = app.get_webview_window("calendar") {
            if calendar_window.is_visible().unwrap_or(false) {
                let clock_was_visible = app
                    .get_webview_window("clock")
                    .and_then(|clock| clock.is_visible().ok())
                    .unwrap_or(false);
                let docked = settings.clock.enabled && clock_was_visible;
                crate::features::calendar::position_calendar(&app, docked, &settings);
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn development_builds_never_enable_autostart() {
        assert!(!should_enable_autostart(true, true));
        assert!(!should_enable_autostart(false, true));
        assert!(should_enable_autostart(true, false));
        assert!(!should_enable_autostart(false, false));
    }

    #[test]
    fn settings_side_effects_only_run_for_changed_sections() {
        let old = AppSettings::default();
        let mut next = old.clone();

        assert!(!file_shelf_window_settings_changed(Some(&old), &next));
        assert!(!clipboard_history_settings_changed(Some(&old), &next));
        assert!(!clock_layout_settings_changed(Some(&old), &next));

        next.theme = "light".to_string();
        assert!(!file_shelf_window_settings_changed(Some(&old), &next));
        assert!(!clipboard_history_settings_changed(Some(&old), &next));
        assert!(!clock_layout_settings_changed(Some(&old), &next));

        next.file_shelf.edge = crate::core::settings_model::FileShelfEdge::Left;
        assert!(file_shelf_window_settings_changed(Some(&old), &next));

        next.file_shelf.clipboard_history_limit += 1;
        assert!(clipboard_history_settings_changed(Some(&old), &next));

        next.clock.size_percent += 10;
        assert!(clock_layout_settings_changed(Some(&old), &next));
    }

    #[test]
    fn write_settings_atomically_writes_file() {
        let temp_dir =
            std::env::temp_dir().join(format!("mint-settings-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).unwrap();
        let path = temp_dir.join("settings.json");

        write_settings_atomically(&path, "{\"theme\":\"dark\"}").unwrap();

        let content = fs::read_to_string(&path).unwrap();
        assert_eq!(content, "{\"theme\":\"dark\"}");
        assert!(temporary_path(&path).unwrap().parent().unwrap() == temp_dir);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn replace_file_preserves_previous_file_on_failure() {
        let temp_dir =
            std::env::temp_dir().join(format!("mint-replace-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).unwrap();
        let destination = temp_dir.join("settings.json");
        fs::write(&destination, "original").unwrap();
        let temp_path = temp_dir.join("settings.tmp");
        fs::write(&temp_path, "updated").unwrap();

        replace_file(&temp_path, &destination).unwrap();

        assert_eq!(fs::read_to_string(&destination).unwrap(), "updated");
        assert!(!temp_path.exists());

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn replace_file_cleans_up_temp_files() {
        let temp_dir = std::env::temp_dir().join(format!(
            "mint-replace-cleanup-test-{}",
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&temp_dir).unwrap();
        let destination = temp_dir.join("settings.json");
        fs::write(&destination, "original").unwrap();
        let temp_path = temp_dir.join("settings.tmp");
        fs::write(&temp_path, "updated").unwrap();

        replace_file(&temp_path, &destination).unwrap();

        assert!(!temp_path.exists());
        let previous_path = temp_path.with_extension("previous");
        assert!(!previous_path.exists());

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
