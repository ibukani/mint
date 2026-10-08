pub use super::settings_model::*;
pub use super::settings_store::{load_settings_cached, load_settings_internal, sync_autostart};

#[tauri::command]
pub fn load_settings(
    app: tauri::AppHandle,
    state: tauri::State<'_, super::settings_model::AppSettingsState>,
) -> Result<super::settings_model::AppSettings, String> {
    super::settings_store::load_settings(app, state)
}

#[tauri::command]
pub fn save_settings(
    app: tauri::AppHandle,
    settings: super::settings_model::AppSettings,
    state: tauri::State<'_, super::settings_model::AppSettingsState>,
) -> Result<(), String> {
    super::settings_store::save_settings(app, settings, state)
}
