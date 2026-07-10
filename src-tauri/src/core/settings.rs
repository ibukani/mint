use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

/// Tauri-managed state that caches `AppSettings` in memory.
/// The inner `Mutex<Option<…>>` starts as `None` and is populated on first
/// load, then kept in sync by `save_settings`.
pub struct AppSettingsState(pub Mutex<Option<AppSettings>>);

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default, rename_all = "camelCase")]
pub struct ClockSettings {
    pub enabled: bool,
    pub shortcut: String,
    pub auto_hide_seconds: u32,
    #[serde(default = "default_show_date")]
    pub show_date: bool,
    #[serde(default = "default_show_seconds")]
    pub show_seconds: bool,
    #[serde(default = "default_clock_color")]
    pub clock_color: String,
    #[serde(default = "default_blink_colon")]
    pub blink_colon: bool,
    #[serde(default = "default_size_percent")]
    pub size_percent: u32,
    #[serde(default = "default_display_mode")]
    pub display_mode: String,
    #[serde(default = "default_hour_format")]
    pub hour_format: String,
    #[serde(default = "default_glow_effect")]
    pub glow_effect: bool,
}

fn default_show_date() -> bool {
    true
}

fn default_show_seconds() -> bool {
    true
}

fn default_clock_color() -> String {
    "#818cf8".to_string()
}

fn default_blink_colon() -> bool {
    true
}

fn default_size_percent() -> u32 {
    100
}

fn default_display_mode() -> String {
    "digital".to_string()
}

fn default_hour_format() -> String {
    "24h".to_string()
}

fn default_glow_effect() -> bool {
    true
}

impl Default for ClockSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            shortcut: "Alt+Left".to_string(),
            auto_hide_seconds: 3,
            show_date: true,
            show_seconds: true,
            clock_color: "#818cf8".to_string(),
            blink_colon: true,
            size_percent: 100,
            display_mode: "digital".to_string(),
            hour_format: "24h".to_string(),
            glow_effect: true,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default, rename_all = "camelCase")]
pub struct VoiceToTextSettings {
    pub enabled: bool,
    pub shortcut: String,
    pub base_url: String,
    pub model: String,
    pub language: String,
    pub status: String,
}

impl Default for VoiceToTextSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            shortcut: "Alt+End".to_string(),
            base_url: "https://api.openai.com/v1".to_string(),
            model: "whisper-1".to_string(),
            language: "ja".to_string(),
            status: "available".to_string(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default, rename_all = "camelCase")]
pub struct AppSettings {
    pub autostart: bool,
    pub theme: String,
    pub settings_shortcut: String,
    pub clock: ClockSettings,
    pub voice_to_text: VoiceToTextSettings,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            autostart: false,
            theme: "dark".to_string(),
            settings_shortcut: "Ctrl+Alt+S".to_string(),
            clock: ClockSettings::default(),
            voice_to_text: VoiceToTextSettings::default(),
        }
    }
}

pub trait ShortcutProvider {
    fn shortcut(&self) -> Option<&str>;
    fn feature_id(&self) -> &str;
}

impl ShortcutProvider for ClockSettings {
    fn shortcut(&self) -> Option<&str> {
        let s = self.shortcut.trim();
        if !self.enabled || s.is_empty() {
            None
        } else {
            Some(s)
        }
    }
    fn feature_id(&self) -> &str {
        "clock"
    }
}

impl ShortcutProvider for VoiceToTextSettings {
    fn shortcut(&self) -> Option<&str> {
        let s = self.shortcut.trim();
        if self.status != "available" || !self.enabled || s.is_empty() {
            None
        } else {
            Some(s)
        }
    }
    fn feature_id(&self) -> &str {
        "voiceToText"
    }
}

impl AppSettings {
    pub fn active_shortcuts(&self) -> Vec<(&str, &str)> {
        let mut list = Vec::new();
        let s = self.settings_shortcut.trim();
        if !s.is_empty() {
            list.push(("settings", s));
        }
        if let Some(s) = self.clock.shortcut() {
            list.push((self.clock.feature_id(), s));
        }
        if let Some(s) = self.voice_to_text.shortcut() {
            list.push((self.voice_to_text.feature_id(), s));
        }
        list
    }
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SettingsError {
    DuplicateShortcut { features: Vec<String> },
    RegistrationFailed { feature: String, message: String },
    IoError { message: String },
}

impl std::fmt::Display for SettingsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}",
            serde_json::to_string(self).unwrap_or_else(|_| "Unknown Error".to_string())
        )
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
pub fn load_settings(
    app: AppHandle,
    state: tauri::State<'_, AppSettingsState>,
) -> Result<AppSettings, String> {
    // Try returning from the in-memory cache first
    if let Some(cached) = state.0.lock().unwrap().clone() {
        return Ok(cached);
    }
    // Cache miss – read from disk and populate the cache
    let settings = load_settings_internal(&app)?;
    *state.0.lock().unwrap() = Some(settings.clone());
    Ok(settings)
}

#[tauri::command]
pub fn save_settings(
    app: AppHandle,
    settings: AppSettings,
    state: tauri::State<'_, AppSettingsState>,
) -> Result<(), String> {
    let new_shortcuts = settings.active_shortcuts();

    // 1. ショートカットの重複チェック
    let mut seen: std::collections::HashMap<&str, &str> = std::collections::HashMap::new();
    let mut duplicates = Vec::new();
    for (fid, sc) in &new_shortcuts {
        if let Some(existing_fid) = seen.get(*sc) {
            duplicates.push(existing_fid.to_string());
            duplicates.push(fid.to_string());
        } else {
            seen.insert(*sc, *fid);
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

    let old_settings = load_settings_internal(&app).ok();

    // 2. ショートカット登録変更とエラーハンドリング（ロールバック付き）
    if let Some(old) = &old_settings {
        use tauri_plugin_global_shortcut::GlobalShortcutExt;
        let gs = app.global_shortcut();

        let old_shortcuts = old.active_shortcuts();

        // 変更を検出する
        // まず、古くて新しくないもの（削除または変更）を解除
        for (fid, old_sc) in &old_shortcuts {
            let new_sc = new_shortcuts
                .iter()
                .find(|(new_fid, _)| new_fid == fid)
                .map(|(_, s)| *s);
            if new_sc != Some(old_sc) {
                let _ = gs.unregister(*old_sc);
            }
        }

        // 新しくて古いものと違うものを登録
        let mut successfully_registered = Vec::new();
        for (fid, new_sc) in &new_shortcuts {
            let old_sc = old_shortcuts
                .iter()
                .find(|(old_fid, _)| old_fid == fid)
                .map(|(_, s)| *s);
            if Some(*new_sc) != old_sc {
                if let Err(e) = gs.register(*new_sc) {
                    // ロールバック: 成功した新規登録を解除
                    for sc in successfully_registered {
                        let _ = gs.unregister(sc);
                    }
                    // 古い登録を復活させる
                    for (old_fid, old_sc) in &old_shortcuts {
                        let new_sc = new_shortcuts
                            .iter()
                            .find(|(new_fid, _)| new_fid == old_fid)
                            .map(|(_, s)| *s);
                        if new_sc != Some(old_sc) {
                            let _ = gs.register(*old_sc);
                        }
                    }
                    return Err(SettingsError::RegistrationFailed {
                        feature: fid.to_string(),
                        message: e.to_string(),
                    }
                    .to_string());
                }
                successfully_registered.push(*new_sc);
            }
        }
    }

    let path = get_config_path(&app)?;
    let json = serde_json::to_string_pretty(&settings).map_err(|e| {
        SettingsError::IoError {
            message: e.to_string(),
        }
        .to_string()
    })?;
    fs::write(&path, json).map_err(|e| {
        SettingsError::IoError {
            message: e.to_string(),
        }
        .to_string()
    })?;

    // Sync autostart setting
    use tauri_plugin_autostart::ManagerExt;
    if settings.autostart {
        let _ = app.autolaunch().enable();
    } else {
        let _ = app.autolaunch().disable();
    }

    // Update the in-memory cache so subsequent reads are instant
    *state.0.lock().unwrap() = Some(settings);

    let _ = tauri::Emitter::emit(&app, "settings-changed", ());

    Ok(())
}

const KEYRING_SERVICE: &str = "com.ibuibu.mint";
const ALLOWED_SERVICES: &[&str] = &["voice_to_text"];

fn validate_service(service: &str) -> Result<(), String> {
    if ALLOWED_SERVICES.contains(&service) {
        Ok(())
    } else {
        Err(format!("Unauthorized service: {}", service))
    }
}

#[tauri::command]
pub fn load_api_key(service: String) -> Result<String, String> {
    validate_service(&service)?;
    let entry = keyring::Entry::new(&format!("{}.{}", KEYRING_SERVICE, service), "api_key")
        .map_err(|e| e.to_string())?;

    match entry.get_password() {
        Ok(key) => Ok(key),
        Err(keyring::Error::NoEntry) => Ok(String::new()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn save_api_key(service: String, key: String) -> Result<(), String> {
    validate_service(&service)?;
    let entry = keyring::Entry::new(&format!("{}.{}", KEYRING_SERVICE, service), "api_key")
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_settings_deserialization_with_missing_fields() {
        // 全く空のJSONから復元
        let empty_json = "{}";
        let settings: AppSettings = serde_json::from_str(empty_json).unwrap();
        assert_eq!(settings.theme, "dark");
        assert_eq!(settings.clock.shortcut, "Alt+Left");
        assert_eq!(settings.clock.auto_hide_seconds, 3);
        assert!(settings.clock.show_date);
        assert!(settings.clock.show_seconds);
        assert_eq!(settings.clock.clock_color, "#818cf8");
        assert!(settings.clock.blink_colon);
        assert_eq!(settings.clock.size_percent, 100);
        assert_eq!(settings.clock.display_mode, "digital");
        assert_eq!(settings.clock.hour_format, "24h");
        assert!(settings.clock.glow_effect);
        assert_eq!(settings.voice_to_text.shortcut, "Alt+End");
        assert_eq!(settings.voice_to_text.language, "ja");

        // 一部だけ存在するJSONから復元
        let partial_json = r#"{"theme": "light", "clock": {"shortcut": "Ctrl+C"}}"#;
        let settings: AppSettings = serde_json::from_str(partial_json).unwrap();
        assert_eq!(settings.theme, "light");
        assert_eq!(settings.clock.shortcut, "Ctrl+C");
        assert_eq!(settings.clock.auto_hide_seconds, 3); // デフォルト補完
        assert!(settings.clock.show_date); // デフォルト補完
        assert!(settings.clock.show_seconds); // デフォルト補完
        assert_eq!(settings.clock.clock_color, "#818cf8"); // デフォルト補完
        assert!(settings.clock.blink_colon); // デフォルト補完
        assert_eq!(settings.clock.size_percent, 100); // デフォルト補完
        assert_eq!(settings.clock.display_mode, "digital"); // デフォルト補完
        assert_eq!(settings.clock.hour_format, "24h"); // デフォルト補完
        assert!(settings.clock.glow_effect); // デフォルト補完
        assert_eq!(settings.voice_to_text.shortcut, "Alt+End"); // デフォルト補完
    }
}
