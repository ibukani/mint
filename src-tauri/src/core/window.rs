use serde::Deserialize;
use std::collections::HashSet;
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

static WINDOW_CREATION_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
static OVERLAY_WINDOW_STATE: OnceLock<Mutex<OverlayWindowState>> = OnceLock::new();

#[derive(Default)]
struct OverlayWindowState {
    pending_initial_show: HashSet<String>,
    frontend_ready: HashSet<String>,
}

fn defers_initial_show(label: &str) -> bool {
    matches!(
        label,
        "clock" | "calendar" | "gameLauncher" | "quickCapture" | "fileShelf" | "calendarEditor"
    )
}

fn overlay_window_state() -> &'static Mutex<OverlayWindowState> {
    OVERLAY_WINDOW_STATE.get_or_init(|| Mutex::new(OverlayWindowState::default()))
}

fn mark_initial_show_pending(label: &str) {
    let mut state = overlay_window_state()
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    state.pending_initial_show.insert(label.to_string());
}

pub fn is_initial_show_pending(label: &str) -> bool {
    overlay_window_state()
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .pending_initial_show
        .contains(label)
}

fn mark_frontend_ready(label: &str) {
    let mut state = overlay_window_state()
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    state.frontend_ready.insert(label.to_string());
}

fn take_initial_show_if_ready(label: &str) -> bool {
    let mut state = overlay_window_state()
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    if !state.pending_initial_show.contains(label)
        || !state.frontend_ready.contains(label)
        || (label == "calendar" && state.pending_initial_show.contains("clock"))
    {
        return false;
    }
    state.pending_initial_show.remove(label)
}

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

    let window = tauri::WebviewWindowBuilder::from_config(app, &config)
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
        })?;

    if defers_initial_show(label) {
        // A newly created WebView initially renders the app loading state. Keep
        // the native window hidden until the overlay component has mounted.
        mark_initial_show_pending(label);
    }

    Ok(window)
}

pub fn ensure_overlay_window(
    app: &AppHandle,
    target: OverlayTarget,
) -> Result<tauri::WebviewWindow, String> {
    ensure_window(app, target.label(), target.display_name())
}

fn show_ready_overlay_windows(app: &AppHandle) -> Result<(), String> {
    loop {
        let mut showed_window = false;

        if take_initial_show_if_ready("clock") {
            let settings = crate::core::settings::load_settings_cached(app)?;
            crate::features::clock::show_clock_overlay(app, &settings);
            showed_window = true;
        }

        if take_initial_show_if_ready("calendar") {
            let settings = crate::core::settings::load_settings_cached(app)?;
            crate::features::calendar::show_calendar_overlay(
                app,
                &settings,
                crate::features::calendar::window::CalendarOpenMode::Month,
            );
            showed_window = true;
        }

        if take_initial_show_if_ready("gameLauncher") {
            crate::features::game_launcher::show_game_launcher_overlay(app);
            showed_window = true;
        }

        if take_initial_show_if_ready("quickCapture") {
            crate::features::quick_capture::show_quick_capture_overlay(app);
            showed_window = true;
        }

        if take_initial_show_if_ready("fileShelf") {
            let settings = crate::core::settings::load_settings_cached(app)?;
            crate::features::file_shelf::show_file_shelf_overlay(app, &settings.file_shelf)?;
            showed_window = true;
        }

        if take_initial_show_if_ready("calendarEditor") {
            crate::features::calendar::show_calendar_editor_when_ready(app)?;
            showed_window = true;
        }

        if !showed_window {
            break;
        }
    }

    Ok(())
}

/// Completes the first-show handshake after React has mounted the overlay.
/// Reopened windows do not need this path because their WebView is already warm.
#[tauri::command]
pub fn overlay_ready(window: WebviewWindow) -> Result<(), String> {
    let label = window.label().to_string();
    if !defers_initial_show(&label) {
        return Ok(());
    }

    mark_frontend_ready(&label);
    show_ready_overlay_windows(window.app_handle())
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

    if !window.is_visible().map_err(|error| error.to_string())?
        && !is_initial_show_pending(target.label())
    {
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
