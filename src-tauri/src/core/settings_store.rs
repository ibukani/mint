use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

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
        fs::write(&path, json).map_err(|e| e.to_string())?;
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

pub fn save_settings(
    app: AppHandle,
    settings: AppSettings,
    state: tauri::State<'_, AppSettingsState>,
) -> Result<(), String> {
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

    sync_autostart(&app, settings.autostart)
        .map_err(|message| SettingsError::AutostartError { message }.to_string())?;

    let old_settings = load_settings_internal(&app).ok();
    if let Some(old) = &old_settings {
        use tauri_plugin_global_shortcut::GlobalShortcutExt;
        let global_shortcut = app.global_shortcut();
        let old_shortcuts = old.active_shortcuts();

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
                return Err(SettingsError::RegistrationFailed {
                    feature: feature_id.to_string(),
                    message: error.to_string(),
                }
                .to_string());
            }
            successfully_registered.push(*new_shortcut);
        }
    }

    let path = get_config_path(&app)?;
    let json = serde_json::to_string_pretty(&settings).map_err(|error| {
        SettingsError::IoError {
            message: error.to_string(),
        }
        .to_string()
    })?;
    fs::write(&path, json).map_err(|error| {
        SettingsError::IoError {
            message: error.to_string(),
        }
        .to_string()
    })?;

    *state.0.lock().unwrap() = Some(settings.clone());
    let _ = app.emit("settings-changed", ());

    crate::features::file_shelf::apply_window_settings(&app, &settings.file_shelf);
    crate::features::file_shelf::apply_clipboard_history_settings(&app, &settings.file_shelf);

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

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::should_enable_autostart;

    #[test]
    fn development_builds_never_enable_autostart() {
        assert!(!should_enable_autostart(true, true));
        assert!(!should_enable_autostart(false, true));
        assert!(should_enable_autostart(true, false));
        assert!(!should_enable_autostart(false, false));
    }
}
