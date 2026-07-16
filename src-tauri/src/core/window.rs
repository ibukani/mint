use serde::Deserialize;
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter, Manager};

static WINDOW_CREATION_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

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

/// Creates a configured window only when it is first needed. Keeping the
/// window configuration in tauri.conf.json preserves static routing while
/// avoiding a WebView process for every hidden overlay during startup.
pub fn ensure_window(
    app: &AppHandle,
    label: &str,
    display_name: &str,
) -> Result<tauri::WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(label) {
        return Ok(window);
    }

    let creation_lock = WINDOW_CREATION_LOCK.get_or_init(|| Mutex::new(()));
    let _guard = creation_lock
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    if let Some(window) = app.get_webview_window(label) {
        return Ok(window);
    }

    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == label)
        .cloned()
        .ok_or_else(|| format!("{}のウィンドウ設定が見つかりません。", display_name))?;

    tauri::WebviewWindowBuilder::from_config(app, &config)
        .map_err(|error| {
            format!(
                "{}のウィンドウを作成できませんでした: {error}",
                display_name
            )
        })?
        .build()
        .map_err(|error| {
            format!(
                "{}のウィンドウを作成できませんでした: {error}",
                display_name
            )
        })
}

pub fn ensure_overlay_window(
    app: &AppHandle,
    target: OverlayTarget,
) -> Result<tauri::WebviewWindow, String> {
    ensure_window(app, target.label(), target.display_name())
}

fn show_main_window_ready(app: &AppHandle) {
    let Ok(window) = ensure_window(app, "main", "設定画面") else {
        return;
    };
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
    let _ = window.emit("main-window-shown", ());
}

/// Shows the main window and recreates its WebView if it was evicted while
/// hidden after a long idle period.
pub fn show_main_window(app: &AppHandle) {
    if app.get_webview_window("main").is_none() {
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            show_main_window_ready(&app);
        });
        return;
    }
    show_main_window_ready(app);
}

#[tauri::command]
pub async fn open_overlay(app: AppHandle, target: OverlayTarget) -> Result<(), String> {
    let settings = crate::core::settings::load_settings_cached(&app)?;
    if !target.is_enabled(&settings) {
        return Err(format!(
            "{}は無効になっています。設定を確認してください。",
            target.display_name()
        ));
    }

    let window = ensure_overlay_window(&app, target)?;

    if matches!(target, OverlayTarget::FileShelf) {
        crate::features::file_shelf::set_file_shelf_expanded(app.clone(), true, true).await?;
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
