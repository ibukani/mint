use serde::Deserialize;
use tauri::{AppHandle, Manager};

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum OverlayTarget {
    Clock,
    Calendar,
    GameLauncher,
    QuickCapture,
    FileShelf,
}

impl OverlayTarget {
    fn label(self) -> &'static str {
        match self {
            Self::Clock => "clock",
            Self::Calendar => "calendar",
            Self::GameLauncher => "gameLauncher",
            Self::QuickCapture => "quickCapture",
            Self::FileShelf => "fileShelf",
        }
    }

    fn display_name(self) -> &'static str {
        match self {
            Self::Clock => "時計",
            Self::Calendar => "カレンダー",
            Self::GameLauncher => "ゲームランチャー",
            Self::QuickCapture => "クイックキャプチャー",
            Self::FileShelf => "ファイルシェル",
        }
    }

    fn is_enabled(self, settings: &crate::core::settings::AppSettings) -> bool {
        match self {
            Self::Clock => settings.clock.enabled,
            Self::Calendar => settings.calendar.enabled,
            Self::GameLauncher => settings.game_launcher.enabled,
            Self::QuickCapture => settings.quick_capture.enabled,
            Self::FileShelf => settings.file_shelf.enabled,
        }
    }
}

#[tauri::command]
pub fn open_overlay(app: AppHandle, target: OverlayTarget) -> Result<(), String> {
    let settings = crate::core::settings::load_settings_internal(&app)?;
    if !target.is_enabled(&settings) {
        return Err(format!(
            "{}は無効になっています。設定を確認してください。",
            target.display_name()
        ));
    }

    let window = app
        .get_webview_window(target.label())
        .ok_or_else(|| format!("{}のウィンドウを利用できません。", target.display_name()))?;

    if matches!(target, OverlayTarget::FileShelf) {
        crate::features::file_shelf::set_file_shelf_expanded(app.clone(), true, true)?;
        if !window.is_visible().map_err(|error| error.to_string())? {
            return Err(format!(
                "{}を開けませんでした。設定で機能が有効か確認してください。",
                target.display_name()
            ));
        }
        return Ok(());
    }

    if window.is_visible().map_err(|error| error.to_string())? {
        window
            .unminimize()
            .map_err(|error| format!("ウィンドウを復元できませんでした: {error}"))?;
        window
            .set_focus()
            .map_err(|error| format!("ウィンドウへフォーカスできませんでした: {error}"))?;
        return Ok(());
    }

    match target {
        OverlayTarget::Clock => crate::features::clock::toggle_clock_overlay(&app),
        OverlayTarget::Calendar => crate::features::calendar::toggle_calendar_overlay(&app),
        OverlayTarget::GameLauncher => {
            crate::features::game_launcher::toggle_game_launcher_overlay(&app)
        }
        OverlayTarget::QuickCapture => {
            crate::features::quick_capture::toggle_quick_capture_overlay(&app)
        }
        OverlayTarget::FileShelf => crate::features::file_shelf::toggle_file_shelf_overlay(&app),
    }

    if !window.is_visible().map_err(|error| error.to_string())? {
        return Err(format!(
            "{}を開けませんでした。設定で機能が有効か確認してください。",
            target.display_name()
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::settings::AppSettings;

    #[test]
    fn overlay_targets_use_stable_window_labels() {
        assert_eq!(OverlayTarget::Clock.label(), "clock");
        assert_eq!(OverlayTarget::Calendar.label(), "calendar");
        assert_eq!(OverlayTarget::GameLauncher.label(), "gameLauncher");
        assert_eq!(OverlayTarget::QuickCapture.label(), "quickCapture");
        assert_eq!(OverlayTarget::FileShelf.label(), "fileShelf");
    }

    #[test]
    fn disabled_overlay_targets_are_rejected_by_settings() {
        let mut settings = AppSettings::default();
        assert!(OverlayTarget::Clock.is_enabled(&settings));
        settings.clock.enabled = false;
        assert!(!OverlayTarget::Clock.is_enabled(&settings));
        settings.file_shelf.enabled = false;
        assert!(!OverlayTarget::FileShelf.is_enabled(&settings));
    }
}
