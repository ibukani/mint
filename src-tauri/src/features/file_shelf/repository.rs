use base64::Engine;
use chrono::{DateTime, Duration, SecondsFormat, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use std::{collections::HashSet, fs, path::Path, time::Duration as StdDuration};
use tauri::{AppHandle, Manager};
use url::Url;
use uuid::Uuid;

use super::models::{
    AddFileShelfContentInput, AddFileShelfPathsInput, FileShelfAvailability, FileShelfGroup,
    FileShelfItem, FileShelfItemKind, FileShelfItemSource, FileShelfMutation, FileShelfPreview,
    FileShelfRemoval, FileShelfState, FileShelfStoreState,
};

pub(super) const MAX_TEXT_BYTES: usize = 1024 * 1024;
pub(super) const MAX_IMAGE_BYTES: usize = 25 * 1024 * 1024;
const MAX_DISPLAY_NAME_CHARS: usize = 120;
const UNDO_SECONDS: i64 = 10;
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

pub(super) fn insert_group(connection: &mut Connection, items: Vec<NewItem>) -> Result<(), String> {
    let group_id = Uuid::new_v4().to_string();
    let created_at = timestamp();
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    transaction
        .execute(
            "INSERT INTO file_shelf_groups(id, created_at) VALUES(?1, ?2)",
            params![group_id, created_at],
        )
        .map_err(|error| error.to_string())?;
    for item in items {
        let id = Uuid::new_v4().to_string();
        let size = item.size_bytes.and_then(|value| i64::try_from(value).ok());
        transaction
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
    transaction.commit().map_err(|error| error.to_string())?;
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

pub(super) fn add_paths_in_store(
    database_path: &Path,
    input: AddFileShelfPathsInput,
) -> Result<FileShelfMutation, String> {
    let mut connection = open_store(database_path)?;
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
        insert_group(&mut connection, items)?;
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

pub(super) fn load_preview_from_store(
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
    let mut connection = open_store(database_path)?;
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
    let cleanup_path = item.source_path.clone();
    if let Err(error) = insert_group(&mut connection, vec![item]) {
        if let Some(path) = cleanup_path {
            let _ = fs::remove_file(path);
        }
        return Err(error);
    }
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

pub(super) fn set_items_pinned_in_store(
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

pub(super) fn rename_item_in_store(
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

pub(super) fn restore_removal_in_store(
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

pub(super) fn restore_recent_removal_in_store(
    database_path: &Path,
) -> Result<FileShelfState, String> {
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
    let mut connection = open_store(database_path)?;
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
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    transaction
        .execute(
            "DELETE FROM file_shelf_items WHERE removed_at IS NOT NULL AND removed_at < ?1",
            [&cutoff],
        )
        .map_err(|error| error.to_string())?;
    transaction
        .execute(
            "DELETE FROM file_shelf_groups
             WHERE NOT EXISTS (
               SELECT 1 FROM file_shelf_items WHERE group_id = file_shelf_groups.id
             )",
            [],
        )
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())?;
    for path in paths.into_iter().flatten() {
        let path = Path::new(&path);
        if is_managed_asset(path, assets_dir) {
            let _ = fs::remove_file(path);
        }
    }
    Ok(())
}
#[cfg(test)]
#[path = "repository_tests.rs"]
mod tests;
