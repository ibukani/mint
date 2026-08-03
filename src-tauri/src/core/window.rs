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
        "clock"
            | "calendar"
            | "gameLauncher"
            | "quickCapture"
            | "fileShelf"
            | "calendarEditor"
            | "mintPalette"
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
    MintPalette,
}

impl OverlayTarget {
    fn label(self) -> &'static str {
        match self {
            Self::Clock => "clock",
            Self::Calendar => "calendar",
            Self::GameLauncher => "gameLauncher",
            Self::QuickCapture => "quickCapture",
            Self::FileShelf => "fileShelf",
            Self::MintPalette => "mintPalette",
        }
    }

    fn display_name(self) -> &'static str {
        match self {
            Self::Clock => "時計",
            Self::Calendar => "カレンダー",
            Self::GameLauncher => "ゲームランチャー",
            Self::QuickCapture => "クイックキャプチャー",
            Self::FileShelf => "ファイルシェル",
            Self::MintPalette => "MintPalette",
        }
    }

    fn is_enabled(self, settings: &crate::core::settings::AppSettings) -> bool {
        match self {
            Self::Clock => settings.clock.enabled,
            Self::Calendar => settings.calendar.enabled,
            Self::GameLauncher => settings.game_launcher.enabled,
            Self::QuickCapture => settings.quick_capture.enabled,
            Self::FileShelf => settings.file_shelf.enabled,
            Self::MintPalette => settings.mint_palette.enabled,
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

    crate::core::performance::record_event(
        app,
        "window:created",
        Some(label),
        None,
        std::collections::HashMap::new(),
    );
    crate::core::performance::increment_counter(app, "windowsCreated");

    Ok(window)
}

pub fn ensure_overlay_window(
    app: &AppHandle,
    target: OverlayTarget,
) -> Result<tauri::WebviewWindow, String> {
    ensure_window(app, target.label(), target.display_name())
}

/// Rejects a high-impact command when it is invoked from a window outside the
/// allowed label allowlist. High-impact commands may only run from the windows
/// declared in docs/security-capabilities.md.
pub fn ensure_window_allowed(
    window: &WebviewWindow,
    allowed_labels: &[&str],
) -> Result<(), String> {
    let label = window.label();
    if window_label_allowed(label, allowed_labels) {
        Ok(())
    } else {
        Err(format!(
            "この操作はウィンドウ \"{label}\" からは実行できません。"
        ))
    }
}

fn window_label_allowed(label: &str, allowed_labels: &[&str]) -> bool {
    allowed_labels.contains(&label)
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

        if take_initial_show_if_ready("mintPalette") {
            crate::features::mint_palette::show_mint_palette_overlay(app);
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
    let _ = crate::core::window_state::restore::restore(app, &window);
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

/// Settings-tab navigation requested by the MintPalette overlay. Kept in
/// pending state so the request survives the case where the main window's
/// WebView was evicted while hidden.
#[derive(Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsTabRequest {
    pub tab: String,
    pub target_id: Option<String>,
}

static PENDING_SETTINGS_TAB_REQUEST: OnceLock<Mutex<Option<SettingsTabRequest>>> = OnceLock::new();

/// Shows the main settings window and asks it to open a settings tab. Available
/// from the main window and the MintPalette overlay.
#[tauri::command]
pub fn open_settings_tab(
    app: AppHandle,
    window: WebviewWindow,
    tab: String,
    target_id: Option<String>,
) -> Result<(), String> {
    ensure_window_allowed(&window, &["main", "mintPalette"])?;

    let request = SettingsTabRequest { tab, target_id };
    *PENDING_SETTINGS_TAB_REQUEST
        .get_or_init(|| Mutex::new(None))
        .lock()
        .unwrap_or_else(|error| error.into_inner()) = Some(request.clone());

    show_main_window(&app);
    app.emit_to("main", "settings-tab-requested", request)
        .map_err(|error| format!("設定画面を開けませんでした: {error}"))
}

/// Consumes a pending settings-tab navigation requested by the MintPalette
/// overlay. Only the main window may call this.
#[tauri::command]
pub fn take_pending_settings_tab(
    window: WebviewWindow,
) -> Result<Option<SettingsTabRequest>, String> {
    ensure_window_allowed(&window, &["main"])?;
    Ok(PENDING_SETTINGS_TAB_REQUEST
        .get_or_init(|| Mutex::new(None))
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .take())
}

#[tauri::command]
pub async fn open_overlay(
    app: AppHandle,
    window: WebviewWindow,
    target: OverlayTarget,
) -> Result<(), String> {
    ensure_window_allowed(&window, &["main", "mintPalette"])?;

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
        OverlayTarget::MintPalette => {
            crate::features::mint_palette::toggle_mint_palette_overlay(&app)
        }
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
        assert_eq!(OverlayTarget::MintPalette.label(), "mintPalette");
    }

    #[test]
    fn disabled_overlay_targets_are_rejected_by_settings() {
        let mut settings = AppSettings::default();
        assert!(OverlayTarget::Clock.is_enabled(&settings));
        settings.clock.enabled = false;
        assert!(!OverlayTarget::Clock.is_enabled(&settings));
        settings.file_shelf.enabled = false;
        assert!(!OverlayTarget::FileShelf.is_enabled(&settings));
        assert!(!OverlayTarget::MintPalette.is_enabled(&settings));
        settings.mint_palette.enabled = true;
        assert!(OverlayTarget::MintPalette.is_enabled(&settings));
    }

    #[test]
    fn window_label_allowed_matches_exact_allowlist_members() {
        assert!(window_label_allowed("main", &["main"]));
        assert!(window_label_allowed("calendar", &["calendar", "main"]));
        assert!(!window_label_allowed("clock", &["main"]));
        assert!(!window_label_allowed("fileShelf", &["calendar", "main"]));
    }
}
