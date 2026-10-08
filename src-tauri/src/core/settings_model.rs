use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

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
    #[serde(default = "default_clock_color", alias = "clockColor")]
    pub theme_color: String,
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
            theme_color: "#818cf8".to_string(),
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
pub struct CalendarSettings {
    pub enabled: bool,
    pub shortcut: String,
    pub create_event_shortcut: String,
    pub selected_google_calendar_ids: Vec<String>,
    pub default_google_calendar_id: String,
    #[serde(default = "default_calendar_color")]
    pub theme_color: String,
}

fn default_calendar_color() -> String {
    "#818cf8".to_string()
}

impl Default for CalendarSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            shortcut: "Alt+Down".to_string(),
            create_event_shortcut: "Alt+Up".to_string(),
            selected_google_calendar_ids: Vec::new(),
            default_google_calendar_id: String::new(),
            theme_color: default_calendar_color(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default, rename_all = "camelCase")]
pub struct GameLauncherSettings {
    pub enabled: bool,
    pub shortcut: String,
    #[serde(default = "default_game_launcher_color")]
    pub theme_color: String,
    pub favorite_game_keys: Vec<String>,
    pub last_played_at_by_game: HashMap<String, String>,
}

fn default_game_launcher_color() -> String {
    "#818cf8".to_string()
}

impl Default for GameLauncherSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            shortcut: "Alt+1".to_string(),
            theme_color: default_game_launcher_color(),
            favorite_game_keys: Vec::new(),
            last_played_at_by_game: HashMap::new(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default, rename_all = "camelCase")]
pub struct MintPaletteSettings {
    pub enabled: bool,
    pub shortcut: String,
}

impl Default for MintPaletteSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            shortcut: "Ctrl+Alt+M".to_string(),
        }
    }
}

/// Current version of the onboarding flow. Bump when the setup content
/// changes materially so returning users can be shown only the new parts.
/// Must stay in sync with `ONBOARDING_VERSION` in src/core/onboarding/onboardingModel.ts.
pub const ONBOARDING_VERSION: u32 = 1;

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct OnboardingSettings {
    pub completed_version: u32,
    pub completed_at: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default, rename_all = "camelCase")]
pub struct AppSettings {
    pub mint_palette: MintPaletteSettings,
    pub game_launcher: GameLauncherSettings,
    pub calendar: CalendarSettings,
    pub autostart: bool,
    pub theme: String,
    pub settings_shortcut: String,
    pub clock: ClockSettings,
    pub onboarding: OnboardingSettings,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            mint_palette: MintPaletteSettings::default(),
            game_launcher: GameLauncherSettings::default(),
            calendar: CalendarSettings::default(),
            autostart: false,
            theme: "system".to_string(),
            settings_shortcut: "Ctrl+Alt+S".to_string(),
            clock: ClockSettings::default(),
            onboarding: OnboardingSettings::default(),
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

impl ShortcutProvider for CalendarSettings {
    fn shortcut(&self) -> Option<&str> {
        let shortcut = self.shortcut.trim();
        if !self.enabled || shortcut.is_empty() {
            None
        } else {
            Some(shortcut)
        }
    }

    fn feature_id(&self) -> &str {
        "calendar"
    }
}

impl ShortcutProvider for GameLauncherSettings {
    fn shortcut(&self) -> Option<&str> {
        let shortcut = self.shortcut.trim();
        if !self.enabled || shortcut.is_empty() {
            None
        } else {
            Some(shortcut)
        }
    }

    fn feature_id(&self) -> &str {
        "gameLauncher"
    }
}

impl ShortcutProvider for MintPaletteSettings {
    fn shortcut(&self) -> Option<&str> {
        let shortcut = self.shortcut.trim();
        if !self.enabled || shortcut.is_empty() {
            None
        } else {
            Some(shortcut)
        }
    }

    fn feature_id(&self) -> &str {
        "mintPalette"
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
        if let Some(s) = self.calendar.shortcut() {
            list.push((self.calendar.feature_id(), s));
        }
        if let Some(s) = self.game_launcher.shortcut() {
            list.push((self.game_launcher.feature_id(), s));
        }

        let create_event_shortcut = self.calendar.create_event_shortcut.trim();
        if self.calendar.enabled && !create_event_shortcut.is_empty() {
            list.push(("calendarCreateEvent", create_event_shortcut));
        }

        if let Some(s) = self.mint_palette.shortcut() {
            list.push((self.mint_palette.feature_id(), s));
        }
        list
    }
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SettingsError {
    DuplicateShortcut { features: Vec<String> },
    RegistrationFailed { feature: String, message: String },
    AutostartError { message: String },
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn theme_preferences_survive_serialized_round_trips() {
        let defaults = serde_json::to_value(AppSettings::default()).unwrap();
        assert_eq!(defaults["theme"], "system");

        for theme in ["dark", "light", "system"] {
            let settings: AppSettings =
                serde_json::from_value(serde_json::json!({ "theme": theme })).unwrap();
            let serialized = serde_json::to_string(&settings).unwrap();
            let restored: AppSettings = serde_json::from_str(&serialized).unwrap();
            assert_eq!(restored.theme, theme);
        }
    }

    #[test]
    fn test_app_settings_deserialization_with_missing_fields() {
        // 全く空のJSONから復元
        let empty_json = "{}";
        let settings: AppSettings = serde_json::from_str(empty_json).unwrap();
        assert_eq!(settings.theme, "system");
        assert_eq!(settings.clock.shortcut, "Alt+Left");
        assert_eq!(settings.clock.auto_hide_seconds, 3);
        assert!(settings.clock.show_date);
        assert!(settings.clock.show_seconds);
        assert_eq!(settings.clock.theme_color, "#818cf8");
        assert!(settings.clock.blink_colon);
        assert_eq!(settings.clock.size_percent, 100);
        assert_eq!(settings.clock.display_mode, "digital");
        assert_eq!(settings.clock.hour_format, "24h");
        assert!(settings.clock.glow_effect);
        assert!(settings.calendar.enabled);
        assert_eq!(settings.calendar.shortcut, "Alt+Down");
        assert_eq!(settings.calendar.create_event_shortcut, "Alt+Up");
        assert!(settings.game_launcher.enabled);
        assert_eq!(settings.game_launcher.shortcut, "Alt+1");
        assert!(settings.game_launcher.favorite_game_keys.is_empty());
        assert!(settings.game_launcher.last_played_at_by_game.is_empty());
        assert!(settings
            .active_shortcuts()
            .contains(&("gameLauncher", "Alt+1")));
        assert!(settings
            .active_shortcuts()
            .contains(&("calendarCreateEvent", "Alt+Up")));
        assert_eq!(settings.onboarding.completed_version, 0);
        assert_eq!(settings.onboarding.completed_at, None);
        assert_eq!(crate::core::settings_model::ONBOARDING_VERSION, 1);

        // 一部だけ存在するJSONから復元
        let partial_json = r#"{"theme": "light", "clock": {"shortcut": "Ctrl+C"}}"#;
        let settings: AppSettings = serde_json::from_str(partial_json).unwrap();
        assert_eq!(settings.theme, "light");
        assert_eq!(settings.clock.shortcut, "Ctrl+C");
        assert_eq!(settings.clock.auto_hide_seconds, 3); // デフォルト補完
        assert!(settings.clock.show_date); // デフォルト補完
        assert!(settings.clock.show_seconds); // デフォルト補完
        assert_eq!(settings.clock.theme_color, "#818cf8"); // デフォルト補完
        assert!(settings.clock.blink_colon); // デフォルト補完
        assert_eq!(settings.clock.size_percent, 100); // デフォルト補完
        assert_eq!(settings.clock.display_mode, "digital"); // デフォルト補完
        assert_eq!(settings.clock.hour_format, "24h"); // デフォルト補完
        assert!(settings.clock.glow_effect); // デフォルト補完
        assert_eq!(settings.calendar.shortcut, "Alt+Down"); // デフォルト補完
        assert_eq!(settings.calendar.create_event_shortcut, "Alt+Up"); // デフォルト補完

        let system_theme_json = r#"{"theme": "system"}"#;
        let settings: AppSettings = serde_json::from_str(system_theme_json).unwrap();
        assert_eq!(settings.theme, "system");

        // clockColor から theme_color へのマイグレーションを検証
        let legacy_clock_json = r##"{
          "clock": {
            "enabled": true,
            "clockColor": "#ff0000"
          }
        }"##;
        let settings: AppSettings = serde_json::from_str(legacy_clock_json).unwrap();
        assert_eq!(settings.clock.theme_color, "#ff0000");
    }
}
