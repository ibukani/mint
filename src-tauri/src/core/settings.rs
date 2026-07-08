use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default, rename_all = "camelCase")]
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
#[serde(default, rename_all = "camelCase")]
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
#[serde(default, rename_all = "camelCase")]
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
    let clock_shortcut = settings.clock.shortcut.trim();
    let v2t_shortcut = settings.voice_to_text.shortcut.trim();

    // 1. ショートカットの重複チェック
    if !clock_shortcut.is_empty() && clock_shortcut == v2t_shortcut {
        return Err(
            "ショートカットキーが重複しています。別々のキーを設定してください。".to_string(),
        );
    }

    let old_settings = load_settings_internal(&app).ok();

    // 2. ショートカット登録変更とエラーハンドリング（ロールバック付き）
    if let Some(old) = &old_settings {
        use tauri_plugin_global_shortcut::GlobalShortcutExt;
        let gs = app.global_shortcut();

        let old_clock = old.clock.shortcut.trim();
        let old_v2t = old.voice_to_text.shortcut.trim();

        // 時計ショートカットの登録変更
        if old_clock != clock_shortcut {
            if !old_clock.is_empty() {
                let _ = gs.unregister(old_clock);
            }
            if !clock_shortcut.is_empty() {
                if let Err(e) = gs.register(clock_shortcut) {
                    // ロールバック: 古い設定に戻す
                    if !old_clock.is_empty() {
                        let _ = gs.register(old_clock);
                    }
                    return Err(format!("時計ショートカット「{}」の登録に失敗しました (すでに他のアプリに登録されている可能性があります): {}", clock_shortcut, e));
                }
            }
        }

        // 音声入力ショートカットの登録変更
        if old_v2t != v2t_shortcut {
            if !old_v2t.is_empty() {
                let _ = gs.unregister(old_v2t);
            }
            if !v2t_shortcut.is_empty() {
                if let Err(e) = gs.register(v2t_shortcut) {
                    // ロールバック: 音声入力の古い設定に戻す
                    if !old_v2t.is_empty() {
                        let _ = gs.register(old_v2t);
                    }
                    // 時計側も変更されていた場合は元に戻す
                    if old_clock != clock_shortcut {
                        if !clock_shortcut.is_empty() {
                            let _ = gs.unregister(clock_shortcut);
                        }
                        if !old_clock.is_empty() {
                            let _ = gs.register(old_clock);
                        }
                    }
                    return Err(format!("音声入力ショートカット「{}」の登録に失敗しました (すでに他のアプリに登録されている可能性があります): {}", v2t_shortcut, e));
                }
            }
        }
    }

    let path = get_config_path(&app)?;
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;

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
        assert_eq!(settings.clock.shortcut, "Ctrl+Alt+C");
        assert_eq!(settings.clock.auto_hide_seconds, 3);
        assert_eq!(settings.clock.font_size, "1.5rem");
        assert_eq!(settings.voice_to_text.shortcut, "Ctrl+Alt+V");
        assert_eq!(settings.voice_to_text.language, "ja");

        // 一部だけ存在するJSONから復元
        let partial_json = r#"{"theme": "light", "clock": {"shortcut": "Ctrl+C"}}"#;
        let settings: AppSettings = serde_json::from_str(partial_json).unwrap();
        assert_eq!(settings.theme, "light");
        assert_eq!(settings.clock.shortcut, "Ctrl+C");
        assert_eq!(settings.clock.auto_hide_seconds, 3); // デフォルト補完
        assert_eq!(settings.voice_to_text.shortcut, "Ctrl+Alt+V"); // デフォルト補完
    }
}
