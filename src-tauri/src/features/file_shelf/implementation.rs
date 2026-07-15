use base64::Engine;
use chrono::{DateTime, Duration, SecondsFormat, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use std::{
    collections::HashSet,
    fs,
    path::Path,
    time::{Duration as StdDuration, Instant},
};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::ShortcutState;
use url::Url;
use uuid::Uuid;

use super::clipboard::{
    capture_current_clipboard, clear_clipboard_history_in_store, foreground_application_name,
    is_application_ignored,
};
#[cfg(test)]
use super::window::shelf_vertical_offset;
use super::window::{set_window_mode, toggle_file_shelf_overlay};
use crate::core::settings::{AppSettings, AppSettingsState, FileShelfSettings};

use super::models::{
    AddFileShelfContentInput, AddFileShelfPathsInput, FileShelfAvailability, FileShelfGroup,
    FileShelfItem, FileShelfItemKind, FileShelfItemSource, FileShelfMutation, FileShelfPreview,
    FileShelfRemoval, FileShelfShortcutState, FileShelfState, FileShelfStoreState,
    FileShelfWindowState,
};

pub(super) const MAX_TEXT_BYTES: usize = 1024 * 1024;
pub(super) const MAX_IMAGE_BYTES: usize = 25 * 1024 * 1024;
const MAX_DISPLAY_NAME_CHARS: usize = 120;
const UNDO_SECONDS: i64 = 10;
const SHORTCUT_DOUBLE_PRESS_INTERVAL: StdDuration = StdDuration::from_millis(550);
const SHORTCUT_LONG_PRESS_INTERVAL: StdDuration = StdDuration::from_millis(800);
const RECENT_REMOVAL_HOURS: i64 = 24;

pub(super) struct NewItem {
    pub(super) kind: FileShelfItemKind,
    pub(super) display_name: String,
    pub(super) source_path: Option<String>,
    pub(super) text_content: Option<String>,
    pub(super) mime_type: Option<String>,
    pub(super) size_bytes: Option<u64>,
    pub(super) source: FileShelfItemSource,
}

pub fn initialize_store(app: &AppHandle) -> Result<FileShelfStoreState, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let assets_dir = directory.join("file_shelf_assets");
    fs::create_dir_all(&assets_dir).map_err(|error| error.to_string())?;
    let state = FileShelfStoreState {
        path: directory.join("file_shelf.sqlite3"),
        assets_dir,
    };
    open_store(&state.path)?;
    purge_old_removals(&state.path, &state.assets_dir)?;
    Ok(state)
}

pub(super) fn timestamp() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Nanos, true)
}

pub(super) fn open_store(path: &Path) -> Result<Connection, String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .busy_timeout(StdDuration::from_secs(5))
        .map_err(|error| error.to_string())?;
    connection
        .execute_batch(
            "PRAGMA foreign_keys = ON;
             CREATE TABLE IF NOT EXISTS file_shelf_groups (
               id TEXT PRIMARY KEY NOT NULL,
               created_at TEXT NOT NULL
             );
             CREATE TABLE IF NOT EXISTS file_shelf_items (
               id TEXT PRIMARY KEY NOT NULL,
               group_id TEXT NOT NULL REFERENCES file_shelf_groups(id) ON DELETE CASCADE,
               kind TEXT NOT NULL,
               display_name TEXT NOT NULL,
               source_path TEXT,
               text_content TEXT,
               mime_type TEXT,
               size_bytes INTEGER,
               created_at TEXT NOT NULL,
               origin TEXT NOT NULL DEFAULT 'manual',
               pinned INTEGER NOT NULL DEFAULT 0,
               removed_at TEXT,
               removal_token TEXT
             );
             CREATE INDEX IF NOT EXISTS file_shelf_items_group_idx
               ON file_shelf_items(group_id);
             CREATE INDEX IF NOT EXISTS file_shelf_items_removal_idx
               ON file_shelf_items(removal_token);",
        )
        .map_err(|error| error.to_string())?;
    let columns = connection
        .prepare("PRAGMA table_info(file_shelf_items)")
        .and_then(|mut statement| {
            let columns = statement.query_map([], |row| row.get::<_, String>(1))?;
            columns.collect::<Result<Vec<_>, _>>()
        })
        .map_err(|error| error.to_string())?;
    if !columns.iter().any(|column| column == "origin") {
        connection
            .execute(
                "ALTER TABLE file_shelf_items ADD COLUMN origin TEXT NOT NULL DEFAULT 'manual'",
                [],
            )
            .map_err(|error| error.to_string())?;
    }
    if !columns.iter().any(|column| column == "pinned") {
        connection
            .execute(
                "ALTER TABLE file_shelf_items ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0",
                [],
            )
            .map_err(|error| error.to_string())?;
    }
    Ok(connection)
}

fn path_key(path: &Path) -> String {
    let value = path.to_string_lossy().to_string();
    if cfg!(target_os = "windows") {
        value.to_lowercase()
    } else {
        value
    }
}

pub(super) fn load_state_from_store(path: &Path) -> Result<FileShelfState, String> {
    let connection = open_store(path)?;
    let mut group_statement = connection
        .prepare(
            "SELECT id, created_at FROM file_shelf_groups
             WHERE EXISTS (
               SELECT 1 FROM file_shelf_items
               WHERE group_id = file_shelf_groups.id AND removed_at IS NULL
             )
             ORDER BY EXISTS (
               SELECT 1 FROM file_shelf_items
               WHERE group_id = file_shelf_groups.id
                 AND removed_at IS NULL AND pinned = 1
             ) DESC, created_at DESC",
        )
        .map_err(|error| error.to_string())?;
    let group_rows = group_statement
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| error.to_string())?;
    let groups = group_rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    drop(group_statement);

    let mut result = Vec::new();
    for (group_id, created_at) in groups {
        let mut item_statement = connection
            .prepare(
                "SELECT id, kind, display_name, source_path, text_content, mime_type,
                        size_bytes, created_at, origin, pinned
                 FROM file_shelf_items
                 WHERE group_id = ?1 AND removed_at IS NULL
                 ORDER BY created_at ASC",
            )
            .map_err(|error| error.to_string())?;
        let item_rows = item_statement
            .query_map([&group_id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, Option<String>>(5)?,
                    row.get::<_, Option<i64>>(6)?,
                    row.get::<_, String>(7)?,
                    row.get::<_, String>(8)?,
                    row.get::<_, bool>(9)?,
                ))
            })
            .map_err(|error| error.to_string())?;
        let mut items = Vec::new();
        for row in item_rows {
            let (
                id,
                kind,
                display_name,
                source_path,
                text_content,
                mime_type,
                size,
                created,
                source,
                pinned,
            ) = row.map_err(|error| error.to_string())?;
            let kind = FileShelfItemKind::from_str(&kind)?;
            let source = FileShelfItemSource::from_str(&source)?;
            let availability = if kind.has_path()
                && source_path
                    .as_ref()
                    .is_none_or(|value| !Path::new(value).exists())
            {
                FileShelfAvailability::Missing
            } else {
                FileShelfAvailability::Ready
            };
            items.push(FileShelfItem {
                id,
                group_id: group_id.clone(),
                kind,
                display_name,
                source_path,
                text_content,
                mime_type,
                size_bytes: size.and_then(|value| u64::try_from(value).ok()),
                created_at: created,
                availability,
                source,
                pinned,
            });
        }
        result.push(FileShelfGroup {
            id: group_id,
            created_at,
            items,
        });
    }
    Ok(FileShelfState { groups: result })
}

pub(super) fn insert_group(connection: &Connection, items: Vec<NewItem>) -> Result<(), String> {
    let group_id = Uuid::new_v4().to_string();
    let created_at = timestamp();
    connection
        .execute(
            "INSERT INTO file_shelf_groups(id, created_at) VALUES(?1, ?2)",
            params![group_id, created_at],
        )
        .map_err(|error| error.to_string())?;
    for item in items {
        let id = Uuid::new_v4().to_string();
        let size = item.size_bytes.and_then(|value| i64::try_from(value).ok());
        connection
            .execute(
                "INSERT INTO file_shelf_items(
                   id, group_id, kind, display_name, source_path, text_content,
                   mime_type, size_bytes, created_at, origin, pinned
                 ) VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0)",
                params![
                    id,
                    group_id,
                    item.kind.as_str(),
                    item.display_name,
                    item.source_path,
                    item.text_content,
                    item.mime_type,
                    size,
                    created_at,
                    item.source.as_str(),
                ],
            )
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn active_path_keys(connection: &Connection) -> Result<HashSet<String>, String> {
    let mut statement = connection
        .prepare(
            "SELECT source_path FROM file_shelf_items
             WHERE removed_at IS NULL AND source_path IS NOT NULL",
        )
        .map_err(|error| error.to_string())?;
    let paths = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?;
    let mut result = HashSet::new();
    for path in paths {
        result.insert(path_key(Path::new(
            &path.map_err(|error| error.to_string())?,
        )));
    }
    Ok(result)
}

fn add_paths_in_store(
    database_path: &Path,
    input: AddFileShelfPathsInput,
) -> Result<FileShelfMutation, String> {
    let connection = open_store(database_path)?;
    let existing = active_path_keys(&connection)?;
    let requested_count = input.paths.len();
    let mut seen = existing;
    let mut items = Vec::new();

    for raw_path in input.paths {
        let Ok(path) = fs::canonicalize(&raw_path) else {
            continue;
        };
        if !seen.insert(path_key(&path)) {
            continue;
        }
        let Ok(metadata) = fs::metadata(&path) else {
            continue;
        };
        let image_mime = image_mime_for_path(&path);
        let kind = if metadata.is_dir() {
            FileShelfItemKind::Folder
        } else if metadata.is_file() && image_mime.is_some() {
            FileShelfItemKind::Image
        } else if metadata.is_file() {
            FileShelfItemKind::File
        } else {
            continue;
        };
        let display_name = path
            .file_name()
            .and_then(|value| value.to_str())
            .map(ToOwned::to_owned)
            .unwrap_or_else(|| path.to_string_lossy().to_string());
        items.push(NewItem {
            kind,
            display_name,
            source_path: Some(path.to_string_lossy().to_string()),
            text_content: None,
            mime_type: image_mime.map(ToOwned::to_owned),
            size_bytes: metadata.is_file().then_some(metadata.len()),
            source: FileShelfItemSource::Manual,
        });
    }

    let added_count = items.len();
    if !items.is_empty() {
        insert_group(&connection, items)?;
    }
    Ok(FileShelfMutation {
        state: load_state_from_store(database_path)?,
        added_count,
        skipped_count: requested_count.saturating_sub(added_count),
    })
}

fn image_mime_for_path(path: &Path) -> Option<&'static str> {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .as_deref()
    {
        Some("png") => Some("image/png"),
        Some("jpg" | "jpeg") => Some("image/jpeg"),
        Some("gif") => Some("image/gif"),
        Some("webp") => Some("image/webp"),
        _ => None,
    }
}

fn load_preview_from_store(
    database_path: &Path,
    item_id: &str,
) -> Result<FileShelfPreview, String> {
    let connection = open_store(database_path)?;
    let record = connection
        .query_row(
            "SELECT source_path, mime_type, kind
             FROM file_shelf_items
             WHERE id = ?1 AND removed_at IS NULL",
            [item_id],
            |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, String>(2)?,
                ))
            },
        )
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "プレビューする項目が見つかりません。".to_string())?;
    let (source_path, stored_mime, kind) = record;
    if kind != FileShelfItemKind::Image.as_str() {
        return Ok(FileShelfPreview { data_url: None });
    }
    let path = source_path.ok_or_else(|| "画像の保存場所が見つかりません。".to_string())?;
    let path = Path::new(&path);
    let mime_type = stored_mime
        .as_deref()
        .or_else(|| image_mime_for_path(path))
        .filter(|value| {
            matches!(
                *value,
                "image/png" | "image/jpeg" | "image/gif" | "image/webp"
            )
        })
        .ok_or_else(|| "この画像形式はプレビューできません。".to_string())?;
    let metadata = fs::metadata(path).map_err(|_| "画像が見つかりません。".to_string())?;
    if metadata.len() > MAX_IMAGE_BYTES as u64 {
        return Err("25MBを超える画像はプレビューできません。".to_string());
    }
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(FileShelfPreview {
        data_url: Some(format!("data:{mime_type};base64,{encoded}")),
    })
}

pub(super) fn display_text(text: &str) -> String {
    let single_line = text.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut chars = single_line.chars();
    let summary = chars.by_ref().take(42).collect::<String>();
    if chars.next().is_some() {
        format!("{summary}…")
    } else {
        summary
    }
}

pub(super) fn is_supported_url(url: &Url) -> bool {
    matches!(url.scheme(), "http" | "https" | "mailto" | "tel")
}

pub(super) fn display_url(url: &Url, original: &str) -> String {
    url.host_str()
        .or_else(|| (!url.path().is_empty()).then(|| url.path()))
        .unwrap_or(original)
        .to_string()
}

fn safe_image_name(file_name: &str, mime_type: &str) -> String {
    let base = Path::new(file_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("pasted-image");
    let safe = base
        .chars()
        .map(|character| {
            if character.is_alphanumeric() || matches!(character, '-' | '_') {
                character
            } else {
                '_'
            }
        })
        .collect::<String>();
    let extension = match mime_type {
        "image/jpeg" => "jpg",
        "image/gif" => "gif",
        "image/webp" => "webp",
        _ => "png",
    };
    format!("{safe}.{extension}")
}

pub(super) fn add_content_in_store(
    database_path: &Path,
    assets_dir: &Path,
    input: AddFileShelfContentInput,
) -> Result<FileShelfMutation, String> {
    let connection = open_store(database_path)?;
    let item = match input {
        AddFileShelfContentInput::Text { text } => {
            let text = text.trim().to_string();
            if text.is_empty() {
                return Err("貼り付ける文章が空です。".to_string());
            }
            if text.len() > MAX_TEXT_BYTES {
                return Err("文章は1MB以下にしてください。".to_string());
            }
            NewItem {
                kind: FileShelfItemKind::Text,
                display_name: display_text(&text),
                source_path: None,
                text_content: Some(text),
                mime_type: Some("text/plain".to_string()),
                size_bytes: None,
                source: FileShelfItemSource::Manual,
            }
        }
        AddFileShelfContentInput::Url { url } => {
            let url = url.trim().to_string();
            if url.len() > MAX_TEXT_BYTES {
                return Err("URLは1MB以下にしてください。".to_string());
            }
            let parsed = Url::parse(&url).map_err(|_| "URLが正しくありません。".to_string())?;
            if !is_supported_url(&parsed) {
                return Err("http、https、mailto、telのURLだけ追加できます。".to_string());
            }
            let display_name = display_url(&parsed, &url);
            NewItem {
                kind: FileShelfItemKind::Url,
                display_name,
                source_path: None,
                text_content: Some(url),
                mime_type: Some("text/uri-list".to_string()),
                size_bytes: None,
                source: FileShelfItemSource::Manual,
            }
        }
        AddFileShelfContentInput::Image {
            file_name,
            mime_type,
            data_base64,
        } => {
            if !matches!(
                mime_type.as_str(),
                "image/png" | "image/jpeg" | "image/gif" | "image/webp"
            ) {
                return Err("PNG、JPEG、GIF、WebP画像だけ追加できます。".to_string());
            }
            if data_base64.len() > (MAX_IMAGE_BYTES * 4 / 3) + 4 {
                return Err("画像は25MB以下にしてください。".to_string());
            }
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(data_base64)
                .map_err(|_| "画像データを読み取れませんでした。".to_string())?;
            if bytes.is_empty() || bytes.len() > MAX_IMAGE_BYTES {
                return Err("画像は25MB以下にしてください。".to_string());
            }
            let display_name = safe_image_name(&file_name, &mime_type);
            let destination = assets_dir.join(format!("{}-{display_name}", Uuid::new_v4()));
            fs::write(&destination, &bytes).map_err(|error| error.to_string())?;
            NewItem {
                kind: FileShelfItemKind::Image,
                display_name,
                source_path: Some(destination.to_string_lossy().to_string()),
                text_content: None,
                mime_type: Some(mime_type),
                size_bytes: Some(bytes.len() as u64),
                source: FileShelfItemSource::Manual,
            }
        }
    };
    insert_group(&connection, vec![item])?;
    Ok(FileShelfMutation {
        state: load_state_from_store(database_path)?,
        added_count: 1,
        skipped_count: 0,
    })
}

pub(super) fn remove_items_in_store(
    database_path: &Path,
    item_ids: Vec<String>,
) -> Result<FileShelfRemoval, String> {
    if item_ids.is_empty() {
        return Err("削除する項目を選択してください。".to_string());
    }
    let connection = open_store(database_path)?;
    let undo_token = Uuid::new_v4().to_string();
    let removed_at = timestamp();
    let mut changed = 0;
    for item_id in item_ids {
        changed += connection
            .execute(
                "UPDATE file_shelf_items
                 SET removed_at = ?1, removal_token = ?2
                 WHERE id = ?3 AND removed_at IS NULL AND pinned = 0",
                params![removed_at, undo_token, item_id],
            )
            .map_err(|error| error.to_string())?;
    }
    if changed == 0 {
        return Err("項目が見つからないか、固定されています。".to_string());
    }
    Ok(FileShelfRemoval {
        state: load_state_from_store(database_path)?,
        undo_token,
    })
}

fn set_items_pinned_in_store(
    database_path: &Path,
    item_ids: Vec<String>,
    pinned: bool,
) -> Result<FileShelfState, String> {
    if item_ids.is_empty() {
        return Err("固定状態を変更する項目を選択してください。".to_string());
    }
    let connection = open_store(database_path)?;
    let mut changed = 0;
    for item_id in item_ids {
        changed += connection
            .execute(
                "UPDATE file_shelf_items SET pinned = ?1
                 WHERE id = ?2 AND removed_at IS NULL AND pinned != ?1",
                params![pinned, item_id],
            )
            .map_err(|error| error.to_string())?;
    }
    if changed == 0 {
        return Err("固定状態を変更できる項目がありません。".to_string());
    }
    load_state_from_store(database_path)
}

fn rename_item_in_store(
    database_path: &Path,
    item_id: String,
    display_name: String,
) -> Result<FileShelfState, String> {
    let display_name = display_name.trim();
    if display_name.is_empty() {
        return Err("棚で表示する名前を入力してください。".to_string());
    }
    if display_name.chars().count() > MAX_DISPLAY_NAME_CHARS {
        return Err(format!(
            "棚で表示する名前は{MAX_DISPLAY_NAME_CHARS}文字以内にしてください。"
        ));
    }
    if display_name.chars().any(char::is_control) {
        return Err("棚で表示する名前に改行や制御文字は使えません。".to_string());
    }

    let connection = open_store(database_path)?;
    let changed = connection
        .execute(
            "UPDATE file_shelf_items SET display_name = ?1
             WHERE id = ?2 AND removed_at IS NULL AND display_name != ?1",
            params![display_name, item_id],
        )
        .map_err(|error| error.to_string())?;
    if changed == 0 {
        return Err("名前を変更できる項目がないか、同じ名前です。".to_string());
    }
    load_state_from_store(database_path)
}

fn restore_removal_in_store(
    database_path: &Path,
    undo_token: String,
) -> Result<FileShelfState, String> {
    let connection = open_store(database_path)?;
    let removed_at = connection
        .query_row(
            "SELECT removed_at FROM file_shelf_items WHERE removal_token = ?1 LIMIT 1",
            [&undo_token],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "元に戻せる項目がありません。".to_string())?;
    let removed_at = DateTime::parse_from_rfc3339(&removed_at)
        .map_err(|error| error.to_string())?
        .with_timezone(&Utc);
    if Utc::now().signed_duration_since(removed_at) > Duration::seconds(UNDO_SECONDS) {
        return Err("元に戻せる時間を過ぎました。".to_string());
    }
    connection
        .execute(
            "UPDATE file_shelf_items
             SET removed_at = NULL, removal_token = NULL
             WHERE removal_token = ?1",
            [&undo_token],
        )
        .map_err(|error| error.to_string())?;
    load_state_from_store(database_path)
}

fn restore_recent_removal_in_store(database_path: &Path) -> Result<FileShelfState, String> {
    let connection = open_store(database_path)?;
    let recent = connection
        .query_row(
            "SELECT removal_token, removed_at
             FROM file_shelf_items
             WHERE removed_at IS NOT NULL AND removal_token IS NOT NULL
             ORDER BY removed_at DESC
             LIMIT 1",
            [],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "最近棚から外した項目はありません。".to_string())?;
    let (undo_token, removed_at) = recent;
    let removed_at = DateTime::parse_from_rfc3339(&removed_at)
        .map_err(|error| error.to_string())?
        .with_timezone(&Utc);
    if Utc::now().signed_duration_since(removed_at) > Duration::hours(RECENT_REMOVAL_HOURS) {
        return Err("呼び戻せる項目の保存期間（24時間）を過ぎました。".to_string());
    }

    let restored_at = timestamp();
    connection
        .execute(
            "UPDATE file_shelf_groups
             SET created_at = ?1
             WHERE id IN (
               SELECT DISTINCT group_id FROM file_shelf_items WHERE removal_token = ?2
             )",
            params![restored_at, undo_token],
        )
        .map_err(|error| error.to_string())?;
    connection
        .execute(
            "UPDATE file_shelf_items
             SET removed_at = NULL, removal_token = NULL
             WHERE removal_token = ?1",
            [&undo_token],
        )
        .map_err(|error| error.to_string())?;
    load_state_from_store(database_path)
}

fn is_managed_asset(path: &Path, assets_dir: &Path) -> bool {
    path.parent().is_some_and(|parent| parent == assets_dir)
}

fn purge_old_removals(database_path: &Path, assets_dir: &Path) -> Result<(), String> {
    let connection = open_store(database_path)?;
    let cutoff = (Utc::now() - Duration::hours(RECENT_REMOVAL_HOURS))
        .to_rfc3339_opts(SecondsFormat::Nanos, true);
    let mut statement = connection
        .prepare(
            "SELECT source_path FROM file_shelf_items
             WHERE kind = 'image' AND removed_at IS NOT NULL AND removed_at < ?1",
        )
        .map_err(|error| error.to_string())?;
    let paths = statement
        .query_map([&cutoff], |row| row.get::<_, Option<String>>(0))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    drop(statement);
    for path in paths.into_iter().flatten() {
        let path = Path::new(&path);
        if is_managed_asset(path, assets_dir) {
            let _ = fs::remove_file(path);
        }
    }
    connection
        .execute(
            "DELETE FROM file_shelf_items WHERE removed_at IS NOT NULL AND removed_at < ?1",
            [&cutoff],
        )
        .map_err(|error| error.to_string())?;
    connection
        .execute(
            "DELETE FROM file_shelf_groups
             WHERE NOT EXISTS (
               SELECT 1 FROM file_shelf_items WHERE group_id = file_shelf_groups.id
             )",
            [],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn load_file_shelf_state(
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfState, String> {
    load_state_from_store(&state.path)
}

pub fn load_file_shelf_preview(
    item_id: String,
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfPreview, String> {
    load_preview_from_store(&state.path, &item_id)
}

pub fn add_file_shelf_paths(
    input: AddFileShelfPathsInput,
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfMutation, String> {
    add_paths_in_store(&state.path, input)
}

pub fn add_file_shelf_content(
    input: AddFileShelfContentInput,
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfMutation, String> {
    add_content_in_store(&state.path, &state.assets_dir, input)
}

pub fn remove_file_shelf_items(
    item_ids: Vec<String>,
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfRemoval, String> {
    remove_items_in_store(&state.path, item_ids)
}

pub fn set_file_shelf_items_pinned(
    item_ids: Vec<String>,
    pinned: bool,
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfState, String> {
    set_items_pinned_in_store(&state.path, item_ids, pinned)
}

pub fn rename_file_shelf_item(
    item_id: String,
    display_name: String,
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfState, String> {
    rename_item_in_store(&state.path, item_id, display_name)
}

pub fn restore_file_shelf_removal(
    undo_token: String,
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfState, String> {
    restore_removal_in_store(&state.path, undo_token)
}

pub fn restore_recent_file_shelf_removal(
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfState, String> {
    restore_recent_removal_in_store(&state.path)
}

pub fn clear_file_shelf(
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfRemoval, String> {
    let current = load_state_from_store(&state.path)?;
    let ids = current
        .groups
        .into_iter()
        .flat_map(|group| {
            group
                .items
                .into_iter()
                .filter(|item| !item.pinned)
                .map(|item| item.id)
        })
        .collect();
    remove_items_in_store(&state.path, ids)
}

pub fn clear_file_shelf_clipboard_history(
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfRemoval, String> {
    clear_clipboard_history_in_store(&state.path)
}

fn is_double_shortcut_press(previous: &mut Option<Instant>, now: Instant) -> bool {
    if previous
        .take()
        .and_then(|value| now.checked_duration_since(value))
        .is_some_and(|elapsed| elapsed <= SHORTCUT_DOUBLE_PRESS_INTERVAL)
    {
        true
    } else {
        *previous = Some(now);
        false
    }
}

fn shortcut_hold_duration(pressed_at: &mut Option<Instant>, now: Instant) -> Option<StdDuration> {
    pressed_at
        .take()
        .and_then(|value| now.checked_duration_since(value))
}

pub fn handle_file_shelf_shortcut_event(
    app: &AppHandle,
    settings: &FileShelfSettings,
    shortcut_state: ShortcutState,
) {
    let now = Instant::now();
    if shortcut_state == ShortcutState::Pressed {
        let double_pressed = app
            .try_state::<FileShelfShortcutState>()
            .and_then(|state| {
                state.0.lock().ok().map(|mut timing| {
                    timing.current_pressed_at = Some(now);
                    is_double_shortcut_press(&mut timing.last_pressed_at, now)
                })
            })
            .unwrap_or(false);
        if !double_pressed {
            toggle_file_shelf_overlay(app);
            return;
        }

        let app = app.clone();
        let settings = settings.clone();
        let _ = std::thread::Builder::new()
            .name("mint-file-shelf-shortcut-capture".to_string())
            .spawn(move || {
                match capture_current_clipboard(&app) {
                    Ok(mutation) => {
                        let notice = if mutation.added_count > 0 {
                            "クリップボードから棚へ保存しました"
                        } else {
                            "同じ内容はすでに棚にあります"
                        };
                        let _ = app.emit("file-shelf-state-changed", mutation.state);
                        let _ = app.emit("file-shelf-notice", notice);
                    }
                    Err(error) => {
                        let _ = app.emit("file-shelf-error", error);
                    }
                }
                let _ = set_window_mode(&app, &settings, true, true);
            });
        return;
    }

    let long_pressed = app
        .try_state::<FileShelfShortcutState>()
        .and_then(|state| {
            state.0.lock().ok().map(|mut timing| {
                let duration = shortcut_hold_duration(&mut timing.current_pressed_at, now);
                let long_pressed =
                    duration.is_some_and(|value| value >= SHORTCUT_LONG_PRESS_INTERVAL);
                if long_pressed {
                    timing.last_pressed_at = None;
                }
                long_pressed
            })
        })
        .unwrap_or(false);
    if !long_pressed {
        return;
    }

    let app = app.clone();
    let settings = settings.clone();
    let _ = std::thread::Builder::new()
        .name("mint-file-shelf-shortcut-restore".to_string())
        .spawn(move || {
            let result = app
                .try_state::<FileShelfStoreState>()
                .ok_or_else(|| "ファイルシェルの保存先を準備できていません。".to_string())
                .and_then(|store| restore_recent_removal_in_store(&store.path));
            match result {
                Ok(state) => {
                    let _ = app.emit("file-shelf-state-changed", state);
                    let _ = app.emit("file-shelf-recent-removal-restored", ());
                    let _ = app.emit("file-shelf-notice", "最近外した項目を棚へ戻しました");
                }
                Err(error) => {
                    let _ = app.emit("file-shelf-error", error);
                }
            }
            let _ = set_window_mode(&app, &settings, true, true);
        });
}

pub fn should_auto_expand_file_shelf(app: AppHandle) -> Result<bool, String> {
    let settings = app
        .try_state::<AppSettingsState>()
        .and_then(|state| state.0.lock().ok().and_then(|value| value.clone()))
        .map(Ok)
        .unwrap_or_else(|| crate::core::settings::load_settings_internal(&app))?;
    Ok(settings.file_shelf.enabled
        && !is_application_ignored(
            &settings.file_shelf,
            foreground_application_name().as_deref(),
        ))
}

pub fn set_file_shelf_expanded(app: AppHandle, expanded: bool, focus: bool) -> Result<(), String> {
    let settings: AppSettings = crate::core::settings::load_settings_internal(&app)?;
    if !settings.file_shelf.enabled {
        return Err("ファイルシェルは無効です。".to_string());
    }
    if !expanded && !settings.file_shelf.edge_handle_enabled {
        if let Some(window) = app.get_webview_window("fileShelf") {
            window.hide().map_err(|error| error.to_string())?;
        }
        if let Some(state) = app.try_state::<FileShelfWindowState>() {
            *state.0.lock().unwrap_or_else(|value| value.into_inner()) = false;
        }
        return Ok(());
    }
    set_window_mode(&app, &settings.file_shelf, expanded, focus && expanded)
}

#[cfg(test)]
mod tests {
    use super::super::clipboard::{
        capture_clipboard_image_in_store, capture_clipboard_text_explicit_in_store,
        capture_clipboard_text_in_store, should_monitor_clipboard,
    };
    use super::*;
    use crate::core::settings::FileShelfVerticalPosition;
    use std::path::PathBuf;

    fn test_paths(name: &str) -> (PathBuf, PathBuf) {
        let root = std::env::temp_dir().join(format!("mint-file-shelf-{name}-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        (root.join("shelf.sqlite3"), root)
    }

    #[test]
    fn ignored_applications_match_executable_names_without_case_sensitivity() {
        let mut settings = FileShelfSettings::default();
        settings
            .ignored_applications
            .push(r#"C:\Tools\PrivateCopy.exe"#.to_string());

        assert!(is_application_ignored(&settings, Some("bitWARDEN.EXE")));
        assert!(is_application_ignored(
            &settings,
            Some(r#"C:\Tools\PrivateCopy.exe"#)
        ));
        assert!(!is_application_ignored(&settings, Some("explorer.exe")));
        assert!(!is_application_ignored(&settings, None));
    }

    #[test]
    fn safe_contact_links_are_urls_and_executable_schemes_are_rejected() {
        let (database, root) = test_paths("contact-links");
        open_store(&database).unwrap();

        let mutation = add_content_in_store(
            &database,
            &root,
            AddFileShelfContentInput::Url {
                url: "mailto:hello@example.com".to_string(),
            },
        )
        .unwrap();
        let item = &mutation.state.groups[0].items[0];
        assert_eq!(item.kind, FileShelfItemKind::Url);
        assert_eq!(item.display_name, "hello@example.com");

        let error = add_content_in_store(
            &database,
            &root,
            AddFileShelfContentInput::Url {
                url: "javascript:alert(1)".to_string(),
            },
        )
        .unwrap_err();
        assert!(error.contains("mailto"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn groups_multiple_paths_and_skips_duplicates() {
        let (database, root) = test_paths("paths");
        let first = root.join("first.txt");
        let second = root.join("second.txt");
        fs::write(&first, "one").unwrap();
        fs::write(&second, "two").unwrap();
        open_store(&database).unwrap();

        let mutation = add_paths_in_store(
            &database,
            AddFileShelfPathsInput {
                paths: vec![
                    first.to_string_lossy().to_string(),
                    second.to_string_lossy().to_string(),
                    first.to_string_lossy().to_string(),
                ],
            },
        )
        .unwrap();

        assert_eq!(mutation.added_count, 2);
        assert_eq!(mutation.skipped_count, 1);
        assert_eq!(mutation.state.groups.len(), 1);
        assert_eq!(mutation.state.groups[0].items.len(), 2);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn image_paths_produce_safe_inline_previews() {
        let (database, root) = test_paths("image-preview");
        let image = root.join("reference.png");
        fs::write(&image, b"png-preview").unwrap();
        open_store(&database).unwrap();
        let mutation = add_paths_in_store(
            &database,
            AddFileShelfPathsInput {
                paths: vec![image.to_string_lossy().to_string()],
            },
        )
        .unwrap();
        let item = &mutation.state.groups[0].items[0];

        assert_eq!(item.kind, FileShelfItemKind::Image);
        assert_eq!(item.mime_type.as_deref(), Some("image/png"));
        let preview = load_preview_from_store(&database, &item.id).unwrap();
        assert!(preview
            .data_url
            .as_deref()
            .is_some_and(|value| value.starts_with("data:image/png;base64,")));
        assert!(load_preview_from_store(&database, "missing-item").is_err());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn shelf_vertical_positions_use_the_available_monitor_height() {
        assert_eq!(
            shelf_vertical_offset(&FileShelfVerticalPosition::Top, 500, None, 100),
            0
        );
        assert_eq!(
            shelf_vertical_offset(&FileShelfVerticalPosition::Center, 500, None, 100),
            250
        );
        assert_eq!(
            shelf_vertical_offset(&FileShelfVerticalPosition::Bottom, 500, None, 100),
            500
        );
        assert_eq!(
            shelf_vertical_offset(&FileShelfVerticalPosition::Cursor, 500, Some(300), 100),
            250
        );
        assert_eq!(
            shelf_vertical_offset(&FileShelfVerticalPosition::Cursor, 500, Some(20), 100),
            0
        );
        assert_eq!(
            shelf_vertical_offset(&FileShelfVerticalPosition::Cursor, 500, Some(580), 100),
            500
        );
        assert_eq!(
            shelf_vertical_offset(&FileShelfVerticalPosition::Cursor, 500, None, 100),
            250
        );
    }

    #[test]
    fn removal_can_be_restored() {
        let (database, root) = test_paths("undo");
        let file = root.join("item.txt");
        fs::write(&file, "item").unwrap();
        open_store(&database).unwrap();
        let mutation = add_paths_in_store(
            &database,
            AddFileShelfPathsInput {
                paths: vec![file.to_string_lossy().to_string()],
            },
        )
        .unwrap();
        let id = mutation.state.groups[0].items[0].id.clone();
        let removal = remove_items_in_store(&database, vec![id]).unwrap();
        assert!(removal.state.groups.is_empty());
        let restored = restore_removal_in_store(&database, removal.undo_token).unwrap();
        assert_eq!(restored.groups.len(), 1);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn recent_removals_can_be_recalled_one_batch_at_a_time() {
        let (database, root) = test_paths("recent-removal");
        let first = root.join("first.txt");
        let second = root.join("second.txt");
        fs::write(&first, "first").unwrap();
        fs::write(&second, "second").unwrap();
        open_store(&database).unwrap();
        let first_mutation = add_paths_in_store(
            &database,
            AddFileShelfPathsInput {
                paths: vec![first.to_string_lossy().to_string()],
            },
        )
        .unwrap();
        let first_id = first_mutation.state.groups[0].items[0].id.clone();
        remove_items_in_store(&database, vec![first_id]).unwrap();
        let second_mutation = add_paths_in_store(
            &database,
            AddFileShelfPathsInput {
                paths: vec![second.to_string_lossy().to_string()],
            },
        )
        .unwrap();
        let second_id = second_mutation.state.groups[0].items[0].id.clone();
        remove_items_in_store(&database, vec![second_id]).unwrap();

        let first_recall = restore_recent_removal_in_store(&database).unwrap();
        assert_eq!(first_recall.groups.len(), 1);
        assert_eq!(first_recall.groups[0].items[0].display_name, "second.txt");
        let second_recall = restore_recent_removal_in_store(&database).unwrap();
        assert_eq!(second_recall.groups.len(), 2);
        assert!(restore_recent_removal_in_store(&database).is_err());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn pinned_items_survive_removal_until_unpinned() {
        let (database, root) = test_paths("pinning");
        let file = root.join("reference.txt");
        fs::write(&file, "reference").unwrap();
        open_store(&database).unwrap();
        let mutation = add_paths_in_store(
            &database,
            AddFileShelfPathsInput {
                paths: vec![file.to_string_lossy().to_string()],
            },
        )
        .unwrap();
        let id = mutation.state.groups[0].items[0].id.clone();

        let pinned = set_items_pinned_in_store(&database, vec![id.clone()], true).unwrap();
        assert!(pinned.groups[0].items[0].pinned);
        assert!(remove_items_in_store(&database, vec![id.clone()]).is_err());
        assert_eq!(load_state_from_store(&database).unwrap().groups.len(), 1);

        set_items_pinned_in_store(&database, vec![id.clone()], false).unwrap();
        let removal = remove_items_in_store(&database, vec![id]).unwrap();
        assert!(removal.state.groups.is_empty());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn shelf_labels_can_change_without_renaming_the_source_file() {
        let (database, root) = test_paths("rename-label");
        let file = root.join("original-name.txt");
        fs::write(&file, "reference").unwrap();
        open_store(&database).unwrap();
        let mutation = add_paths_in_store(
            &database,
            AddFileShelfPathsInput {
                paths: vec![file.to_string_lossy().to_string()],
            },
        )
        .unwrap();
        let id = mutation.state.groups[0].items[0].id.clone();
        let source_path = mutation.state.groups[0].items[0].source_path.clone();

        let renamed =
            rename_item_in_store(&database, id.clone(), "  提出用  ".to_string()).unwrap();
        assert_eq!(renamed.groups[0].items[0].display_name, "提出用");
        assert_eq!(renamed.groups[0].items[0].source_path, source_path);
        assert!(file.exists());
        assert!(rename_item_in_store(&database, id.clone(), "\n".to_string()).is_err());
        assert!(rename_item_in_store(&database, id, "x".repeat(121)).is_err());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn managed_asset_check_rejects_paths_outside_the_shelf_directory() {
        let root = PathBuf::from("/mint-data");
        let assets = root.join("file_shelf_assets");

        assert!(is_managed_asset(&assets.join("pasted.png"), &assets));
        assert!(!is_managed_asset(&root.join("settings.json"), &assets));
        assert!(!is_managed_asset(
            &assets.join("nested").join("pasted.png"),
            &assets,
        ));
    }

    #[test]
    fn clipboard_history_deduplicates_and_prunes_without_touching_manual_items() {
        let (database, root) = test_paths("clipboard-history");
        let file = root.join("manual.txt");
        fs::write(&file, "manual").unwrap();
        open_store(&database).unwrap();
        add_paths_in_store(
            &database,
            AddFileShelfPathsInput {
                paths: vec![file.to_string_lossy().to_string()],
            },
        )
        .unwrap();

        for index in 0..6 {
            capture_clipboard_text_in_store(&database, format!("history {index}"), 5).unwrap();
        }
        let duplicate =
            capture_clipboard_text_in_store(&database, "history 2".to_string(), 5).unwrap();

        assert_eq!(duplicate.added_count, 0);
        assert_eq!(duplicate.state.groups.len(), 6);
        assert_eq!(
            duplicate.state.groups[0].items[0].text_content.as_deref(),
            Some("history 2")
        );
        assert_eq!(
            duplicate
                .state
                .groups
                .iter()
                .flat_map(|group| &group.items)
                .filter(|item| item.source == FileShelfItemSource::ClipboardHistory)
                .count(),
            5
        );
        assert!(duplicate
            .state
            .groups
            .iter()
            .flat_map(|group| &group.items)
            .any(|item| item.source == FileShelfItemSource::Manual));

        let cleared = clear_clipboard_history_in_store(&database).unwrap();
        assert_eq!(cleared.state.groups.len(), 1);
        assert_eq!(
            cleared.state.groups[0].items[0].source,
            FileShelfItemSource::Manual
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn explicit_clipboard_capture_is_deduplicated_and_promotes_history() {
        let (database, root) = test_paths("explicit-clipboard");
        open_store(&database).unwrap();
        capture_clipboard_text_in_store(&database, "https://example.com".to_string(), 25).unwrap();

        let promoted =
            capture_clipboard_text_explicit_in_store(&database, "https://example.com".to_string())
                .unwrap();
        assert_eq!(promoted.added_count, 1);
        assert_eq!(
            promoted.state.groups[0].items[0].source,
            FileShelfItemSource::Manual
        );

        let duplicate =
            capture_clipboard_text_explicit_in_store(&database, "https://example.com".to_string())
                .unwrap();
        assert_eq!(duplicate.added_count, 0);
        assert_eq!(duplicate.skipped_count, 1);

        assert!(clear_clipboard_history_in_store(&database).is_err());
        assert_eq!(load_state_from_store(&database).unwrap().groups.len(), 1);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn clipboard_images_are_encoded_as_managed_png_files() {
        let (database, root) = test_paths("explicit-clipboard-image");
        let assets = root.join("assets");
        fs::create_dir_all(&assets).unwrap();
        open_store(&database).unwrap();

        let mutation = capture_clipboard_image_in_store(
            &database,
            &assets,
            &[255, 0, 0, 255, 0, 255, 0, 255],
            2,
            1,
        )
        .unwrap();
        let item = &mutation.state.groups[0].items[0];
        assert_eq!(item.kind, FileShelfItemKind::Image);
        assert_eq!(item.source, FileShelfItemSource::Manual);
        assert!(item
            .source_path
            .as_ref()
            .is_some_and(|path| Path::new(path).exists()));
        assert!(capture_clipboard_image_in_store(&database, &assets, &[0; 4], 2, 1).is_err());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn shortcut_double_press_uses_a_bounded_interval() {
        let start = Instant::now();
        let mut previous = None;
        assert!(!is_double_shortcut_press(&mut previous, start));
        assert!(is_double_shortcut_press(
            &mut previous,
            start + StdDuration::from_millis(400)
        ));
        assert!(previous.is_none());
        assert!(!is_double_shortcut_press(
            &mut previous,
            start + StdDuration::from_millis(1_000)
        ));
        assert!(!is_double_shortcut_press(
            &mut previous,
            start + StdDuration::from_millis(1_700)
        ));
    }

    #[test]
    fn shortcut_long_press_requires_eight_hundred_milliseconds() {
        let start = Instant::now();
        let mut pressed_at = Some(start);
        assert_eq!(
            shortcut_hold_duration(&mut pressed_at, start + StdDuration::from_millis(799)),
            Some(StdDuration::from_millis(799))
        );
        assert!(pressed_at.is_none());

        pressed_at = Some(start);
        assert!(
            shortcut_hold_duration(&mut pressed_at, start + SHORTCUT_LONG_PRESS_INTERVAL)
                .is_some_and(|duration| duration >= SHORTCUT_LONG_PRESS_INTERVAL)
        );
    }

    #[test]
    fn existing_shelf_database_migrates_items_to_manual_source() {
        let (database, root) = test_paths("origin-migration");
        let connection = Connection::open(&database).unwrap();
        connection
            .execute_batch(
                "PRAGMA foreign_keys = ON;
                 CREATE TABLE file_shelf_groups (
                   id TEXT PRIMARY KEY NOT NULL,
                   created_at TEXT NOT NULL
                 );
                 CREATE TABLE file_shelf_items (
                   id TEXT PRIMARY KEY NOT NULL,
                   group_id TEXT NOT NULL REFERENCES file_shelf_groups(id) ON DELETE CASCADE,
                   kind TEXT NOT NULL,
                   display_name TEXT NOT NULL,
                   source_path TEXT,
                   text_content TEXT,
                   mime_type TEXT,
                   size_bytes INTEGER,
                   created_at TEXT NOT NULL,
                   removed_at TEXT,
                   removal_token TEXT
                 );
                 INSERT INTO file_shelf_groups(id, created_at) VALUES('group', '2026-07-13T00:00:00Z');
                 INSERT INTO file_shelf_items(
                   id, group_id, kind, display_name, text_content, created_at
                 ) VALUES('item', 'group', 'text', 'saved text', 'saved text', '2026-07-13T00:00:00Z');",
            )
            .unwrap();
        drop(connection);

        open_store(&database).unwrap();
        let state = load_state_from_store(&database).unwrap();
        assert_eq!(state.groups[0].items[0].source, FileShelfItemSource::Manual);
        assert!(!state.groups[0].items[0].pinned);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn clipboard_monitor_requires_explicit_opt_in() {
        let mut settings = FileShelfSettings::default();
        assert!(!should_monitor_clipboard(&settings));

        settings.clipboard_history_enabled = true;
        assert!(should_monitor_clipboard(&settings));

        settings.enabled = false;
        assert!(!should_monitor_clipboard(&settings));
    }
}
