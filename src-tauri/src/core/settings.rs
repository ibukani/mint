pub use super::settings_model::*;
pub use super::settings_store::{load_settings_internal, sync_autostart};

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

#[tauri::command]
pub fn load_api_key(service: String) -> Result<String, String> {
    super::settings_api_keys::load_api_key(service)
}

#[tauri::command]
pub fn save_api_key(service: String, key: String) -> Result<(), String> {
    super::settings_api_keys::save_api_key(service, key)
}
