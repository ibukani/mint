use image::{codecs::png::PngEncoder, ExtendedColorType, ImageEncoder};
use rusqlite::{params, OptionalExtension};
use std::{
    fs,
    path::Path,
    sync::atomic::{AtomicBool, Ordering},
    sync::{Arc, Condvar, Mutex},
    time::Duration as StdDuration,
};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use url::Url;
use uuid::Uuid;

#[cfg(target_os = "windows")]
use std::{ffi::OsString, os::windows::ffi::OsStringExt, path::PathBuf};
#[cfg(target_os = "windows")]
use windows_sys::Win32::{
    Foundation::{CloseHandle, HWND},
    System::{
        DataExchange::GetClipboardOwner,
        Threading::{
            OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
            PROCESS_QUERY_LIMITED_INFORMATION,
        },
    },
    UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId},
};

use crate::core::settings::{AppSettingsState, FileShelfSettings};

use super::{
    models::{
        FileShelfItemKind, FileShelfItemSource, FileShelfMutation, FileShelfRemoval,
        FileShelfStoreState,
    },
    repository::{
        add_content_in_store, display_text, display_url, insert_group, load_state_from_store,
        open_store, remove_items_in_store, timestamp, NewItem, MAX_IMAGE_BYTES, MAX_TEXT_BYTES,
    },
};

const CLIPBOARD_POLL_INTERVAL: StdDuration = StdDuration::from_millis(900);
const CLIPBOARD_IDLE_INTERVAL: StdDuration = StdDuration::from_secs(30);
const MAX_CLIPBOARD_HISTORY_BYTES: usize = 64 * 1024;
const MAX_CLIPBOARD_IMAGE_RGBA_BYTES: usize = 128 * 1024 * 1024;

#[derive(Default)]
struct MonitorWakeState {
    notified: bool,
}

pub struct ClipboardHistoryMonitor {
    running: AtomicBool,
    wake: Condvar,
    wake_state: Mutex<MonitorWakeState>,
}

impl ClipboardHistoryMonitor {
    pub fn new() -> Self {
        Self {
            running: AtomicBool::new(true),
            wake: Condvar::new(),
            wake_state: Mutex::new(MonitorWakeState::default()),
        }
    }

    pub fn notify(&self) {
        let mut state = self
            .wake_state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        state.notified = true;
        self.wake.notify_one();
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::Release);
        self.notify();
    }

    fn is_running(&self) -> bool {
        self.running.load(Ordering::Acquire)
    }

    fn wait(&self, timeout: StdDuration) -> bool {
        let mut state = self
            .wake_state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if !state.notified && self.is_running() {
            state = match self.wake.wait_timeout(state, timeout) {
                Ok((state, _)) => state,
                Err(error) => error.into_inner().0,
            };
        }
        let notified = state.notified;
        state.notified = false;
        notified
    }
}

impl Default for ClipboardHistoryMonitor {
    fn default() -> Self {
        Self::new()
    }
}

fn load_file_shelf_settings(app: &AppHandle) -> Option<FileShelfSettings> {
    app.try_state::<AppSettingsState>()
        .and_then(|state| state.0.lock().ok().and_then(|value| value.clone()))
        .or_else(|| crate::core::settings::load_settings_internal(app).ok())
        .map(|settings| settings.file_shelf)
}

pub fn start_clipboard_history_monitor(app: AppHandle, monitor: Arc<ClipboardHistoryMonitor>) {
    let _ = std::thread::Builder::new()
        .name("mint-clipboard-history".to_string())
        .spawn(move || {
            let mut settings = load_file_shelf_settings(&app);
            let mut monitoring = false;
            let mut previous_text = String::new();
            let mut previous_oversized_length: Option<usize> = None;

            while monitor.is_running() {
                let Some(file_shelf_settings) = settings.as_ref() else {
                    monitor.wait(CLIPBOARD_IDLE_INTERVAL);
                    settings = load_file_shelf_settings(&app);
                    continue;
                };

                if !should_monitor_clipboard(file_shelf_settings) {
                    monitoring = false;
                    previous_text.clear();
                    previous_oversized_length = None;
                    monitor.wait(CLIPBOARD_IDLE_INTERVAL);
                    settings = load_file_shelf_settings(&app);
                    continue;
                }

                if monitor.wait(CLIPBOARD_POLL_INTERVAL) {
                    settings = load_file_shelf_settings(&app);
                    continue;
                }
                if !monitor.is_running() {
                    break;
                }

                let raw_text = match app.clipboard().read_text() {
                    Ok(text) => text,
                    Err(_) => {
                        monitoring = true;
                        previous_text.clear();
                        previous_oversized_length = None;
                        continue;
                    }
                };

                let trimmed_text = raw_text.trim();
                if trimmed_text.is_empty() {
                    continue;
                }
                if trimmed_text.len() > MAX_CLIPBOARD_HISTORY_BYTES {
                    if previous_oversized_length == Some(trimmed_text.len()) {
                        continue;
                    }
                    previous_oversized_length = Some(trimmed_text.len());
                    previous_text.clear();
                    monitoring = true;
                    continue;
                }

                previous_oversized_length = None;
                let current_text = trimmed_text.to_string();
                if !monitoring {
                    monitoring = true;
                    previous_text = current_text;
                    continue;
                }
                if current_text == previous_text {
                    continue;
                }
                previous_text.clone_from(&current_text);
                if is_application_ignored(
                    file_shelf_settings,
                    clipboard_source_application_name().as_deref(),
                ) {
                    continue;
                }

                let Some(store) = app.try_state::<FileShelfStoreState>() else {
                    continue;
                };
                if let Ok(mutation) = capture_clipboard_text_in_store(
                    &store.path,
                    current_text,
                    file_shelf_settings.clipboard_history_limit,
                ) {
                    if mutation.added_count > 0 || mutation.skipped_count == 0 {
                        let _ = app.emit("file-shelf-state-changed", mutation.state);
                    }
                }
            }
        });
}

pub fn apply_clipboard_history_settings(app: &AppHandle, settings: &FileShelfSettings) {
    let Some(store) = app.try_state::<FileShelfStoreState>() else {
        return;
    };
    let Ok(connection) = open_store(&store.path) else {
        return;
    };
    let Ok(removed) = prune_clipboard_history(
        &connection,
        clipboard_history_limit(settings.clipboard_history_limit),
    ) else {
        return;
    };
    if removed > 0 {
        if let Ok(state) = load_state_from_store(&store.path) {
            let _ = app.emit("file-shelf-state-changed", state);
        }
    }
}

pub(super) fn should_monitor_clipboard(settings: &FileShelfSettings) -> bool {
    settings.enabled && settings.clipboard_history_enabled
}

fn normalized_application_name(value: &str) -> Option<String> {
    let trimmed = value.trim().trim_matches('"');
    if trimmed.is_empty() {
        return None;
    }
    Path::new(trimmed)
        .file_name()
        .and_then(|name| name.to_str())
        .map(str::to_string)
}

pub(super) fn is_application_ignored(
    settings: &FileShelfSettings,
    application: Option<&str>,
) -> bool {
    let Some(application) = application.and_then(normalized_application_name) else {
        return false;
    };
    settings.ignored_applications.iter().any(|ignored| {
        normalized_application_name(ignored)
            .is_some_and(|candidate| candidate.eq_ignore_ascii_case(&application))
    })
}

#[cfg(target_os = "windows")]
fn application_name_from_window(window: HWND) -> Option<String> {
    if window.is_null() {
        return None;
    }
    let mut process_id = 0;
    unsafe {
        GetWindowThreadProcessId(window, &mut process_id);
    }
    if process_id == 0 {
        return None;
    }
    let process = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, process_id) };
    if process.is_null() {
        return None;
    }
    let mut path = vec![0_u16; 32_768];
    let mut path_length = path.len() as u32;
    let succeeded = unsafe {
        QueryFullProcessImageNameW(
            process,
            PROCESS_NAME_WIN32,
            path.as_mut_ptr(),
            &mut path_length,
        )
    } != 0;
    unsafe {
        CloseHandle(process);
    }
    if !succeeded || path_length == 0 {
        return None;
    }
    let path = PathBuf::from(OsString::from_wide(&path[..path_length as usize]));
    path.file_name()
        .and_then(|name| name.to_str())
        .map(str::to_string)
}

#[cfg(target_os = "windows")]
pub(super) fn foreground_application_name() -> Option<String> {
    application_name_from_window(unsafe { GetForegroundWindow() })
}

#[cfg(not(target_os = "windows"))]
pub(super) fn foreground_application_name() -> Option<String> {
    None
}

#[cfg(target_os = "windows")]
fn clipboard_source_application_name() -> Option<String> {
    application_name_from_window(unsafe { GetClipboardOwner() })
        .or_else(foreground_application_name)
}

#[cfg(not(target_os = "windows"))]
fn clipboard_source_application_name() -> Option<String> {
    None
}

fn clipboard_history_limit(value: u32) -> usize {
    value.clamp(5, 100) as usize
}

fn prune_clipboard_history(
    connection: &rusqlite::Connection,
    max_items: usize,
) -> Result<usize, String> {
    let mut statement = connection
        .prepare(
            "SELECT DISTINCT group_id
             FROM file_shelf_items
             WHERE origin = 'clipboardHistory' AND removed_at IS NULL AND pinned = 0
             ORDER BY created_at DESC",
        )
        .map_err(|error| error.to_string())?;
    let stale_groups = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?
        .skip(max_items)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    drop(statement);

    let mut removed = 0;
    for group_id in stale_groups {
        removed += connection
            .execute("DELETE FROM file_shelf_groups WHERE id = ?1", [group_id])
            .map_err(|error| error.to_string())?;
    }
    Ok(removed)
}

pub(super) fn capture_clipboard_text_in_store(
    database_path: &Path,
    text: String,
    max_items: u32,
) -> Result<FileShelfMutation, String> {
    let text = text.trim().to_string();
    if text.is_empty() || text.len() > MAX_CLIPBOARD_HISTORY_BYTES {
        return Err("クリップボード履歴は64KB以下の文章またはURLに対応しています。".to_string());
    }

    let mut connection = open_store(database_path)?;
    let existing = connection
        .query_row(
            "SELECT group_id, origin
             FROM file_shelf_items
             WHERE text_content = ?1 AND removed_at IS NULL
             LIMIT 1",
            [&text],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    if let Some((group_id, origin)) = existing {
        let promoted = origin == FileShelfItemSource::ClipboardHistory.as_str();
        if promoted {
            let created_at = timestamp();
            connection
                .execute(
                    "UPDATE file_shelf_groups SET created_at = ?1 WHERE id = ?2",
                    params![created_at, group_id],
                )
                .map_err(|error| error.to_string())?;
            connection
                .execute(
                    "UPDATE file_shelf_items SET created_at = ?1 WHERE group_id = ?2",
                    params![created_at, group_id],
                )
                .map_err(|error| error.to_string())?;
        }
        prune_clipboard_history(&connection, clipboard_history_limit(max_items))?;
        return Ok(FileShelfMutation {
            state: load_state_from_store(database_path)?,
            added_count: 0,
            skipped_count: usize::from(!promoted),
        });
    }

    let parsed_url = Url::parse(&text)
        .ok()
        .filter(super::repository::is_supported_url);
    let item = if let Some(url) = parsed_url {
        NewItem {
            kind: FileShelfItemKind::Url,
            display_name: display_url(&url, &text),
            source_path: None,
            text_content: Some(text),
            mime_type: Some("text/uri-list".to_string()),
            size_bytes: None,
            source: FileShelfItemSource::ClipboardHistory,
        }
    } else {
        NewItem {
            kind: FileShelfItemKind::Text,
            display_name: display_text(&text),
            source_path: None,
            text_content: Some(text),
            mime_type: Some("text/plain".to_string()),
            size_bytes: None,
            source: FileShelfItemSource::ClipboardHistory,
        }
    };
    insert_group(&mut connection, vec![item])?;
    prune_clipboard_history(&connection, clipboard_history_limit(max_items))?;
    Ok(FileShelfMutation {
        state: load_state_from_store(database_path)?,
        added_count: 1,
        skipped_count: 0,
    })
}

pub(super) fn capture_clipboard_text_explicit_in_store(
    database_path: &Path,
    text: String,
) -> Result<FileShelfMutation, String> {
    let text = text.trim().to_string();
    if text.is_empty() {
        return Err("クリップボードに文章または画像がありません。".to_string());
    }
    if text.len() > MAX_TEXT_BYTES {
        return Err("クリップボードの文章は1MB以下にしてください。".to_string());
    }

    let connection = open_store(database_path)?;
    let existing = connection
        .query_row(
            "SELECT group_id, origin
             FROM file_shelf_items
             WHERE text_content = ?1 AND removed_at IS NULL
             LIMIT 1",
            [&text],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    if let Some((group_id, origin)) = existing {
        if origin == FileShelfItemSource::ClipboardHistory.as_str() {
            let created_at = timestamp();
            connection
                .execute(
                    "UPDATE file_shelf_items
                     SET origin = 'manual', created_at = ?1
                     WHERE group_id = ?2",
                    params![created_at, group_id],
                )
                .map_err(|error| error.to_string())?;
            connection
                .execute(
                    "UPDATE file_shelf_groups SET created_at = ?1 WHERE id = ?2",
                    params![created_at, group_id],
                )
                .map_err(|error| error.to_string())?;
            return Ok(FileShelfMutation {
                state: load_state_from_store(database_path)?,
                added_count: 1,
                skipped_count: 0,
            });
        }
        return Ok(FileShelfMutation {
            state: load_state_from_store(database_path)?,
            added_count: 0,
            skipped_count: 1,
        });
    }
    drop(connection);

    let input = Url::parse(&text)
        .ok()
        .filter(super::repository::is_supported_url)
        .map(|_| super::models::AddFileShelfContentInput::Url { url: text.clone() })
        .unwrap_or(super::models::AddFileShelfContentInput::Text { text });
    add_content_in_store(database_path, Path::new(""), input)
}

pub(super) fn capture_clipboard_image_in_store(
    database_path: &Path,
    assets_dir: &Path,
    rgba: &[u8],
    width: u32,
    height: u32,
) -> Result<FileShelfMutation, String> {
    let expected_length = (width as usize)
        .checked_mul(height as usize)
        .and_then(|pixels| pixels.checked_mul(4))
        .ok_or_else(|| "クリップボード画像のサイズが大きすぎます。".to_string())?;
    if width == 0
        || height == 0
        || rgba.len() != expected_length
        || rgba.len() > MAX_CLIPBOARD_IMAGE_RGBA_BYTES
    {
        return Err("クリップボード画像のサイズが大きすぎます。".to_string());
    }

    let mut png = Vec::new();
    PngEncoder::new(&mut png)
        .write_image(rgba, width, height, ExtendedColorType::Rgba8)
        .map_err(|error| format!("クリップボード画像をPNGに変換できませんでした: {error}"))?;
    if png.is_empty() || png.len() > MAX_IMAGE_BYTES {
        return Err("クリップボード画像はPNG変換後25MB以下にしてください。".to_string());
    }

    let mut connection = open_store(database_path)?;
    let destination = assets_dir.join(format!("{}-clipboard-image.png", Uuid::new_v4()));
    fs::write(&destination, &png).map_err(|error| error.to_string())?;
    let insert_result = insert_group(
        &mut connection,
        vec![NewItem {
            kind: FileShelfItemKind::Image,
            display_name: "クリップボード画像.png".to_string(),
            source_path: Some(destination.to_string_lossy().to_string()),
            text_content: None,
            mime_type: Some("image/png".to_string()),
            size_bytes: Some(png.len() as u64),
            source: FileShelfItemSource::Manual,
        }],
    );
    if let Err(error) = insert_result {
        let _ = fs::remove_file(destination);
        return Err(error);
    }
    Ok(FileShelfMutation {
        state: load_state_from_store(database_path)?,
        added_count: 1,
        skipped_count: 0,
    })
}

pub(super) fn clear_clipboard_history_in_store(
    database_path: &Path,
) -> Result<FileShelfRemoval, String> {
    let connection = open_store(database_path)?;
    let mut statement = connection
        .prepare(
            "SELECT id FROM file_shelf_items
             WHERE origin = 'clipboardHistory' AND removed_at IS NULL AND pinned = 0",
        )
        .map_err(|error| error.to_string())?;
    let ids = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    drop(statement);
    if ids.is_empty() {
        return Err("消去できるクリップボード履歴がありません。".to_string());
    }
    remove_items_in_store(database_path, ids)
}

pub(super) fn capture_current_clipboard(app: &AppHandle) -> Result<FileShelfMutation, String> {
    let store = app
        .try_state::<FileShelfStoreState>()
        .ok_or_else(|| "ファイルシェルの保存先を準備できていません。".to_string())?;

    if let Ok(image) = app.clipboard().read_image() {
        return capture_clipboard_image_in_store(
            &store.path,
            &store.assets_dir,
            image.rgba(),
            image.width(),
            image.height(),
        );
    }

    let text = app
        .clipboard()
        .read_text()
        .map_err(|_| "クリップボードに対応する文章、URL、画像がありません。".to_string())?;
    capture_clipboard_text_explicit_in_store(&store.path, text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn monitor_notifications_are_consumed_without_polling() {
        let monitor = ClipboardHistoryMonitor::new();

        assert!(!monitor.wait(StdDuration::ZERO));
        monitor.notify();
        assert!(monitor.wait(StdDuration::ZERO));
        assert!(!monitor.wait(StdDuration::ZERO));

        monitor.stop();
        assert!(!monitor.is_running());
    }
}
