use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ClockSettings {
    pub shortcut: String,
    pub auto_hide_seconds: u32,
    pub font_size: String,
}

impl Default for ClockSettings {
    fn default() -> Self {
        Self {
            shortcut: "Ctrl+Alt+C".to_string(),
            auto_hide_seconds: 3,
            font_size: "1.5rem".to_string(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct VoiceToTextSettings {
    pub shortcut: String,
    pub base_url: String,
    pub model: String,
    pub language: String,
}

impl Default for VoiceToTextSettings {
    fn default() -> Self {
        Self {
            shortcut: "Ctrl+Alt+V".to_string(),
            base_url: "https://api.openai.com/v1".to_string(),
            model: "whisper-1".to_string(),
            language: "ja".to_string(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,
    pub clock: ClockSettings,
    pub voice_to_text: VoiceToTextSettings,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            clock: ClockSettings::default(),
            voice_to_text: VoiceToTextSettings::default(),
        }
    }
}

fn get_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app.path().app_config_dir().map_err(|e| e.to_string())?;
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }
    Ok(path.join("settings.json"))
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

#[tauri::command]
pub fn load_settings(app: AppHandle) -> Result<AppSettings, String> {
    load_settings_internal(&app)
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = get_config_path(&app)?;
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

const KEYRING_SERVICE: &str = "com.ibuibu.mint";

#[tauri::command]
pub fn load_api_key(service: String) -> Result<String, String> {
    let entry = keyring::Entry::new(
        &format!("{}.{}", KEYRING_SERVICE, service),
        "api_key",
    )
    .map_err(|e| e.to_string())?;

    match entry.get_password() {
        Ok(key) => Ok(key),
        Err(keyring::Error::NoEntry) => Ok(String::new()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn save_api_key(service: String, key: String) -> Result<(), String> {
    let entry = keyring::Entry::new(
        &format!("{}.{}", KEYRING_SERVICE, service),
        "api_key",
    )
    .map_err(|e| e.to_string())?;

    if key.is_empty() {
        // Delete credential if key is empty
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    } else {
        entry.set_password(&key).map_err(|e| e.to_string())
    }
}
