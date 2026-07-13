use chrono::{SecondsFormat, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;
use zip::{write::SimpleFileOptions, ZipArchive, ZipWriter};

pub struct QuickCaptureStoreState {
    path: PathBuf,
    data_dir: PathBuf,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickCaptureDraft {
    pub content: String,
    pub tags: Vec<String>,
    pub updated_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickCaptureNote {
    pub id: String,
    pub content: String,
    pub tags: Vec<String>,
    pub pinned: bool,
    pub created_at: String,
    pub updated_at: String,
    pub attachments: Vec<QuickCaptureAttachment>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickCaptureAttachment {
    pub id: String,
    pub file_name: String,
    pub mime_type: String,
    pub size_bytes: u64,
    pub stored_path: String,
    pub created_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickCaptureState {
    pub draft: QuickCaptureDraft,
    pub notes: Vec<QuickCaptureNote>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickCapturePromotion {
    pub note: QuickCaptureNote,
    pub draft: QuickCaptureDraft,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickCaptureDraftInput {
    pub content: String,
    pub tags: Vec<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickCaptureNoteInput {
    pub content: String,
    pub tags: Vec<String>,
    pub pinned: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickCaptureAttachmentInput {
    pub note_id: String,
    pub source_path: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickCaptureExportInput {
    pub path: String,
    pub content: String,
    pub tags: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct QuickCaptureBackup {
    version: u32,
    state: QuickCaptureState,
}

pub fn initialize_store(app: &AppHandle) -> Result<QuickCaptureStoreState, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let state = QuickCaptureStoreState {
        path: directory.join("quick_capture.sqlite3"),
        data_dir: directory,
    };
    open_store(&state.path)?;
    Ok(state)
}

fn open_store(path: &Path) -> Result<Connection, String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .busy_timeout(Duration::from_secs(5))
        .map_err(|error| error.to_string())?;
    connection
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS quick_capture_draft (
               singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
               content TEXT NOT NULL,
               updated_at TEXT NOT NULL
             );
             CREATE TABLE IF NOT EXISTS quick_capture_draft_tags (
               tag TEXT PRIMARY KEY NOT NULL
             );
             CREATE TABLE IF NOT EXISTS quick_capture_notes (
               id TEXT PRIMARY KEY NOT NULL,
               content TEXT NOT NULL,
               pinned INTEGER NOT NULL DEFAULT 0,
               created_at TEXT NOT NULL,
               updated_at TEXT NOT NULL
             );
             CREATE TABLE IF NOT EXISTS quick_capture_note_tags (
               note_id TEXT NOT NULL REFERENCES quick_capture_notes(id) ON DELETE CASCADE,
               tag TEXT NOT NULL,
               PRIMARY KEY(note_id, tag)
             );
             CREATE TABLE IF NOT EXISTS quick_capture_attachments (
               id TEXT PRIMARY KEY NOT NULL,
               note_id TEXT NOT NULL REFERENCES quick_capture_notes(id) ON DELETE CASCADE,
               file_name TEXT NOT NULL,
               mime_type TEXT NOT NULL,
               size_bytes INTEGER NOT NULL,
               stored_path TEXT NOT NULL,
               created_at TEXT NOT NULL
             );
             CREATE INDEX IF NOT EXISTS quick_capture_notes_order
               ON quick_capture_notes(pinned DESC, updated_at DESC);",
        )
        .map_err(|error| error.to_string())?;
    connection
        .execute("PRAGMA foreign_keys = ON", [])
        .map_err(|error| error.to_string())?;
    Ok(connection)
}

fn timestamp() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn normalize_tags(tags: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    tags.into_iter()
        .filter_map(|tag| {
            let value = tag.trim().trim_start_matches('#').trim().to_string();
            if value.is_empty() || !seen.insert(value.to_lowercase()) {
                None
            } else {
                Some(value)
            }
        })
        .collect()
}

fn read_tags(connection: &Connection, note_id: &str) -> Result<Vec<String>, String> {
    let mut statement = connection
        .prepare("SELECT tag FROM quick_capture_note_tags WHERE note_id = ?1 ORDER BY tag COLLATE NOCASE")
        .map_err(|error| error.to_string())?;
    let tags = statement
        .query_map([note_id], |row| row.get(0))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(tags)
}

fn read_attachments(
    connection: &Connection,
    note_id: &str,
) -> Result<Vec<QuickCaptureAttachment>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, file_name, mime_type, size_bytes, stored_path, created_at
             FROM quick_capture_attachments WHERE note_id = ?1 ORDER BY created_at DESC",
        )
        .map_err(|error| error.to_string())?;
    let attachments = statement
        .query_map([note_id], |row| {
            Ok(QuickCaptureAttachment {
                id: row.get(0)?,
                file_name: row.get(1)?,
                mime_type: row.get(2)?,
                size_bytes: row.get(3)?,
                stored_path: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(attachments)
}

fn load_state_from_store(path: &Path) -> Result<QuickCaptureState, String> {
    let connection = open_store(path)?;
    let draft_row = connection
        .query_row(
            "SELECT content, updated_at FROM quick_capture_draft WHERE singleton = 1",
            [],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    let draft_tags = {
        let mut statement = connection
            .prepare("SELECT tag FROM quick_capture_draft_tags ORDER BY tag COLLATE NOCASE")
            .map_err(|error| error.to_string())?;
        let tags = statement
            .query_map([], |row| row.get(0))
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;
        tags
    };
    let draft = draft_row
        .map(|(content, updated_at)| QuickCaptureDraft {
            content,
            tags: draft_tags,
            updated_at,
        })
        .unwrap_or_else(|| QuickCaptureDraft {
            content: String::new(),
            tags: Vec::new(),
            updated_at: timestamp(),
        });

    let mut statement = connection
        .prepare("SELECT id, content, pinned, created_at, updated_at FROM quick_capture_notes ORDER BY pinned DESC, updated_at DESC")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, bool>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
            ))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    let notes = rows
        .into_iter()
        .map(|(id, content, pinned, created_at, updated_at)| {
            Ok(QuickCaptureNote {
                tags: read_tags(&connection, &id)?,
                attachments: read_attachments(&connection, &id)?,
                id,
                content,
                pinned,
                created_at,
                updated_at,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;
    Ok(QuickCaptureState { draft, notes })
}

fn replace_tags(
    transaction: &rusqlite::Transaction<'_>,
    note_id: &str,
    tags: Vec<String>,
) -> Result<Vec<String>, String> {
    let tags = normalize_tags(tags);
    transaction
        .execute(
            "DELETE FROM quick_capture_note_tags WHERE note_id = ?1",
            [note_id],
        )
        .map_err(|error| error.to_string())?;
    for tag in &tags {
        transaction
            .execute(
                "INSERT INTO quick_capture_note_tags(note_id, tag) VALUES(?1, ?2)",
                params![note_id, tag],
            )
            .map_err(|error| error.to_string())?;
    }
    Ok(tags)
}

#[tauri::command]
pub fn load_quick_capture_state(
    state: tauri::State<'_, QuickCaptureStoreState>,
) -> Result<QuickCaptureState, String> {
    load_state_from_store(&state.path)
}

#[tauri::command]
pub fn save_quick_capture_draft(
    input: QuickCaptureDraftInput,
    state: tauri::State<'_, QuickCaptureStoreState>,
) -> Result<QuickCaptureDraft, String> {
    save_draft_in_store(&state.path, input)
}

fn save_draft_in_store(
    path: &Path,
    input: QuickCaptureDraftInput,
) -> Result<QuickCaptureDraft, String> {
    let mut connection = open_store(path)?;
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    let tags = normalize_tags(input.tags);
    let updated_at = timestamp();
    transaction
        .execute(
            "INSERT INTO quick_capture_draft(singleton, content, updated_at) VALUES(1, ?1, ?2)
             ON CONFLICT(singleton) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at",
            params![input.content, updated_at],
        )
        .map_err(|error| error.to_string())?;
    transaction
        .execute("DELETE FROM quick_capture_draft_tags", [])
        .map_err(|error| error.to_string())?;
    for tag in &tags {
        transaction
            .execute(
                "INSERT INTO quick_capture_draft_tags(tag) VALUES(?1)",
                [tag],
            )
            .map_err(|error| error.to_string())?;
    }
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(QuickCaptureDraft {
        content: input.content,
        tags,
        updated_at,
    })
}

#[tauri::command]
pub fn promote_quick_capture_note(
    input: QuickCaptureNoteInput,
    state: tauri::State<'_, QuickCaptureStoreState>,
) -> Result<QuickCapturePromotion, String> {
    promote_note_in_store(&state.path, input)
}

fn promote_note_in_store(
    path: &Path,
    input: QuickCaptureNoteInput,
) -> Result<QuickCapturePromotion, String> {
    if input.content.trim().is_empty() {
        return Err("メモの本文を入力してください。".to_string());
    }

    let mut connection = open_store(path)?;
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    let id = Uuid::new_v4().to_string();
    let note_timestamp = timestamp();
    transaction
        .execute(
            "INSERT INTO quick_capture_notes(id, content, pinned, created_at, updated_at) VALUES(?1, ?2, ?3, ?4, ?5)",
            params![
                id,
                input.content,
                input.pinned,
                note_timestamp,
                note_timestamp
            ],
        )
        .map_err(|error| error.to_string())?;
    let tags = replace_tags(&transaction, &id, input.tags)?;

    let draft_timestamp = timestamp();
    transaction
        .execute(
            "INSERT INTO quick_capture_draft(singleton, content, updated_at) VALUES(1, ?1, ?2)
             ON CONFLICT(singleton) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at",
            params!["", draft_timestamp],
        )
        .map_err(|error| error.to_string())?;
    transaction
        .execute("DELETE FROM quick_capture_draft_tags", [])
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())?;

    Ok(QuickCapturePromotion {
        note: QuickCaptureNote {
            id,
            content: input.content,
            tags,
            pinned: input.pinned,
            attachments: Vec::new(),
            created_at: note_timestamp.clone(),
            updated_at: note_timestamp,
        },
        draft: QuickCaptureDraft {
            content: String::new(),
            tags: Vec::new(),
            updated_at: draft_timestamp,
        },
    })
}

#[tauri::command]
pub fn create_quick_capture_note(
    input: QuickCaptureNoteInput,
    state: tauri::State<'_, QuickCaptureStoreState>,
) -> Result<QuickCaptureNote, String> {
    create_note_in_store(&state.path, input)
}

fn create_note_in_store(
    path: &Path,
    input: QuickCaptureNoteInput,
) -> Result<QuickCaptureNote, String> {
    if input.content.trim().is_empty() {
        return Err("メモの本文を入力してください。".to_string());
    }
    let mut connection = open_store(path)?;
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = timestamp();
    transaction
        .execute(
            "INSERT INTO quick_capture_notes(id, content, pinned, created_at, updated_at) VALUES(?1, ?2, ?3, ?4, ?5)",
            params![id, input.content, input.pinned, now, now],
        )
        .map_err(|error| error.to_string())?;
    let tags = replace_tags(&transaction, &id, input.tags)?;
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(QuickCaptureNote {
        id,
        content: input.content,
        tags,
        pinned: input.pinned,
        attachments: Vec::new(),
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn update_quick_capture_note(
    id: String,
    input: QuickCaptureNoteInput,
    state: tauri::State<'_, QuickCaptureStoreState>,
) -> Result<QuickCaptureNote, String> {
    update_note_in_store(&state.path, id, input)
}

fn update_note_in_store(
    path: &Path,
    id: String,
    input: QuickCaptureNoteInput,
) -> Result<QuickCaptureNote, String> {
    if input.content.trim().is_empty() {
        return Err("メモの本文を入力してください。".to_string());
    }
    let mut connection = open_store(path)?;
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    let created_at = transaction
        .query_row(
            "SELECT created_at FROM quick_capture_notes WHERE id = ?1",
            [&id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "メモが見つかりません。".to_string())?;
    let updated_at = timestamp();
    transaction
        .execute("UPDATE quick_capture_notes SET content = ?2, pinned = ?3, updated_at = ?4 WHERE id = ?1", params![id, input.content, input.pinned, updated_at])
        .map_err(|error| error.to_string())?;
    let tags = replace_tags(&transaction, &id, input.tags)?;
    let attachments = read_attachments(&transaction, &id)?;
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(QuickCaptureNote {
        id,
        content: input.content,
        tags,
        pinned: input.pinned,
        attachments,
        created_at,
        updated_at,
    })
}

#[tauri::command]
pub fn delete_quick_capture_note(
    id: String,
    state: tauri::State<'_, QuickCaptureStoreState>,
) -> Result<(), String> {
    delete_note_in_store(&state.path, id)
}

fn delete_note_in_store(path: &Path, id: String) -> Result<(), String> {
    let connection = open_store(path)?;
    let mut statement = connection
        .prepare("SELECT stored_path FROM quick_capture_attachments WHERE note_id = ?1")
        .map_err(|error| error.to_string())?;
    let attachment_paths = statement
        .query_map([&id], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    drop(statement);
    for stored_path in attachment_paths {
        let _ = fs::remove_file(stored_path);
    }
    let changed = connection
        .execute("DELETE FROM quick_capture_notes WHERE id = ?1", [&id])
        .map_err(|error| error.to_string())?;
    if changed == 0 {
        Err("メモが見つかりません。".to_string())
    } else {
        Ok(())
    }
}

fn mime_type_for(path: &Path) -> String {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "pdf" => "application/pdf",
        "txt" => "text/plain",
        "md" => "text/markdown",
        "csv" => "text/csv",
        "json" => "application/json",
        "zip" => "application/zip",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "mp4" => "video/mp4",
        _ => "application/octet-stream",
    }
    .to_string()
}

fn add_attachment_in_store(
    database_path: &Path,
    data_dir: &Path,
    input: QuickCaptureAttachmentInput,
) -> Result<QuickCaptureAttachment, String> {
    let source = Path::new(&input.source_path);
    let metadata = fs::metadata(source).map_err(|error| error.to_string())?;
    if !metadata.is_file() {
        return Err("添付できるファイルを指定してください。".to_string());
    }
    const MAX_ATTACHMENT_BYTES: u64 = 100 * 1024 * 1024;
    if metadata.len() > MAX_ATTACHMENT_BYTES {
        return Err("添付ファイルは100MB以下にしてください。".to_string());
    }
    let file_name = source
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .ok_or_else(|| "添付ファイル名を取得できません。".to_string())?
        .to_string();
    let connection = open_store(database_path)?;
    let note_exists: bool = connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM quick_capture_notes WHERE id = ?1)",
            [&input.note_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if !note_exists {
        return Err("メモが見つかりません。".to_string());
    }
    let id = Uuid::new_v4().to_string();
    let directory = data_dir
        .join("quick_capture_attachments")
        .join(&input.note_id);
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let stored_path = directory.join(format!("{id}-{file_name}"));
    fs::copy(source, &stored_path).map_err(|error| error.to_string())?;
    let created_at = timestamp();
    let attachment = QuickCaptureAttachment {
        id,
        file_name,
        mime_type: mime_type_for(source),
        size_bytes: metadata.len(),
        stored_path: stored_path.to_string_lossy().to_string(),
        created_at,
    };
    connection
        .execute(
            "INSERT INTO quick_capture_attachments(id, note_id, file_name, mime_type, size_bytes, stored_path, created_at)
             VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                attachment.id,
                input.note_id,
                attachment.file_name,
                attachment.mime_type,
                attachment.size_bytes,
                attachment.stored_path,
                attachment.created_at,
            ],
        )
        .map_err(|error| error.to_string())?;
    Ok(attachment)
}

#[tauri::command]
pub fn add_quick_capture_attachment(
    input: QuickCaptureAttachmentInput,
    state: tauri::State<'_, QuickCaptureStoreState>,
) -> Result<QuickCaptureAttachment, String> {
    add_attachment_in_store(&state.path, &state.data_dir, input)
}

#[tauri::command]
pub fn delete_quick_capture_attachment(
    note_id: String,
    attachment_id: String,
    state: tauri::State<'_, QuickCaptureStoreState>,
) -> Result<(), String> {
    delete_attachment_in_store(&state.path, note_id, attachment_id)
}

fn delete_attachment_in_store(
    database_path: &Path,
    note_id: String,
    attachment_id: String,
) -> Result<(), String> {
    let connection = open_store(database_path)?;
    let stored_path = connection
        .query_row(
            "SELECT stored_path FROM quick_capture_attachments WHERE id = ?1 AND note_id = ?2",
            params![attachment_id, note_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "添付ファイルが見つかりません。".to_string())?;
    let _ = fs::remove_file(stored_path);
    connection
        .execute(
            "DELETE FROM quick_capture_attachments WHERE id = ?1 AND note_id = ?2",
            params![attachment_id, note_id],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn export_quick_capture_markdown(input: QuickCaptureExportInput) -> Result<(), String> {
    if input.path.trim().is_empty() {
        return Err("書き出し先を指定してください。".to_string());
    }
    if input.content.trim().is_empty() {
        return Err("本文が空のメモは書き出せません。".to_string());
    }
    let tags = normalize_tags(input.tags);
    let mut markdown = input.content;
    if !tags.is_empty() {
        markdown.push_str("\n\n---\n\nTags: ");
        markdown.push_str(
            &tags
                .iter()
                .map(|tag| format!("#{tag}"))
                .collect::<Vec<_>>()
                .join(" "),
        );
        markdown.push('\n');
    }
    fs::write(input.path, markdown).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn export_quick_capture_backup(
    path: String,
    state: tauri::State<'_, QuickCaptureStoreState>,
) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("バックアップ先を指定してください。".to_string());
    }
    let current = load_state_from_store(&state.path)?;
    let file = fs::File::create(path).map_err(|error| error.to_string())?;
    let mut archive = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    for note in &current.notes {
        for attachment in &note.attachments {
            let bytes = fs::read(&attachment.stored_path).map_err(|error| {
                format!(
                    "添付ファイル {} をバックアップできません: {error}",
                    attachment.file_name
                )
            })?;
            archive
                .start_file(
                    format!("attachments/{}/{}", note.id, attachment.id),
                    options,
                )
                .map_err(|error| error.to_string())?;
            archive
                .write_all(&bytes)
                .map_err(|error| error.to_string())?;
        }
    }
    archive
        .start_file("manifest.json", options)
        .map_err(|error| error.to_string())?;
    let manifest = serde_json::to_vec(&QuickCaptureBackup {
        version: 1,
        state: current,
    })
    .map_err(|error| error.to_string())?;
    archive
        .write_all(&manifest)
        .map_err(|error| error.to_string())?;
    archive.finish().map_err(|error| error.to_string())?;
    Ok(())
}

fn safe_attachment_name(file_name: &str) -> String {
    let name = Path::new(file_name)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("attachment");
    name.chars()
        .map(|character| {
            if character.is_control()
                || ['/', '\\', ':', '*', '?', '"', '<', '>', '|'].contains(&character)
            {
                '_'
            } else {
                character
            }
        })
        .collect()
}

#[tauri::command]
pub fn import_quick_capture_backup(
    path: String,
    state: tauri::State<'_, QuickCaptureStoreState>,
) -> Result<QuickCaptureState, String> {
    if path.trim().is_empty() {
        return Err("復元するバックアップを指定してください。".to_string());
    }
    let file = fs::File::open(path).map_err(|error| error.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|error| error.to_string())?;
    let mut manifest_file = archive
        .by_name("manifest.json")
        .map_err(|error| format!("バックアップのmanifestが見つかりません: {error}"))?;
    let mut manifest_bytes = Vec::new();
    manifest_file
        .read_to_end(&mut manifest_bytes)
        .map_err(|error| error.to_string())?;
    drop(manifest_file);
    let backup: QuickCaptureBackup = serde_json::from_slice(&manifest_bytes)
        .map_err(|error| format!("バックアップの形式が不正です: {error}"))?;
    if backup.version != 1 {
        return Err("対応していないバックアップ形式です。".to_string());
    }

    for note in &backup.state.notes {
        for attachment in &note.attachments {
            let entry_name = format!("attachments/{}/{}", note.id, attachment.id);
            archive.by_name(&entry_name).map_err(|error| {
                format!(
                    "添付ファイル {} が見つかりません: {error}",
                    attachment.file_name
                )
            })?;
        }
    }

    let attachment_root = state.data_dir.join("quick_capture_attachments");
    let _ = fs::remove_dir_all(&attachment_root);
    fs::create_dir_all(&attachment_root).map_err(|error| error.to_string())?;
    let mut connection = open_store(&state.path)?;
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    transaction
        .execute("DELETE FROM quick_capture_notes", [])
        .map_err(|error| error.to_string())?;
    transaction
        .execute("DELETE FROM quick_capture_draft_tags", [])
        .map_err(|error| error.to_string())?;
    transaction
        .execute("DELETE FROM quick_capture_draft", [])
        .map_err(|error| error.to_string())?;

    transaction
        .execute(
            "INSERT INTO quick_capture_draft(singleton, content, updated_at) VALUES(1, ?1, ?2)",
            params![backup.state.draft.content, backup.state.draft.updated_at],
        )
        .map_err(|error| error.to_string())?;
    for tag in normalize_tags(backup.state.draft.tags) {
        transaction
            .execute(
                "INSERT INTO quick_capture_draft_tags(tag) VALUES(?1)",
                [tag],
            )
            .map_err(|error| error.to_string())?;
    }

    for note in backup.state.notes {
        transaction
            .execute(
                "INSERT INTO quick_capture_notes(id, content, pinned, created_at, updated_at) VALUES(?1, ?2, ?3, ?4, ?5)",
                params![note.id, note.content, note.pinned, note.created_at, note.updated_at],
            )
            .map_err(|error| error.to_string())?;
        for tag in normalize_tags(note.tags) {
            transaction
                .execute(
                    "INSERT INTO quick_capture_note_tags(note_id, tag) VALUES(?1, ?2)",
                    params![note.id, tag],
                )
                .map_err(|error| error.to_string())?;
        }
        for attachment in note.attachments {
            let entry_name = format!("attachments/{}/{}", note.id, attachment.id);
            let mut entry = archive.by_name(&entry_name).map_err(|error| {
                format!(
                    "添付ファイル {} が見つかりません: {error}",
                    attachment.file_name
                )
            })?;
            let mut bytes = Vec::new();
            entry
                .read_to_end(&mut bytes)
                .map_err(|error| error.to_string())?;
            let destination_dir = attachment_root.join(&note.id);
            fs::create_dir_all(&destination_dir).map_err(|error| error.to_string())?;
            let destination = destination_dir.join(format!(
                "{}-{}",
                attachment.id,
                safe_attachment_name(&attachment.file_name)
            ));
            fs::write(&destination, bytes).map_err(|error| error.to_string())?;
            transaction
                .execute(
                    "INSERT INTO quick_capture_attachments(id, note_id, file_name, mime_type, size_bytes, stored_path, created_at) VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![attachment.id, note.id, attachment.file_name, attachment.mime_type, attachment.size_bytes, destination.to_string_lossy(), attachment.created_at],
                )
                .map_err(|error| error.to_string())?;
        }
    }
    transaction.commit().map_err(|error| error.to_string())?;
    load_state_from_store(&state.path)
}

pub fn toggle_quick_capture_overlay(app: &AppHandle) {
    let Some(window) = app.get_webview_window("quickCapture") else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.emit("quick-capture-hide-requested", ());
    } else {
        let _ = window.center();
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit("quick-capture-shown", ());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_path() -> PathBuf {
        std::env::temp_dir().join(format!("mint-quick-capture-{}.sqlite3", Uuid::new_v4()))
    }

    #[test]
    fn tags_are_trimmed_and_deduplicated() {
        assert_eq!(
            normalize_tags(vec![" #Work ".into(), "work".into(), "".into()]),
            vec!["Work"]
        );
    }

    #[test]
    fn draft_and_note_crud_round_trip() {
        let path = test_path();
        let draft = save_draft_in_store(
            &path,
            QuickCaptureDraftInput {
                content: "途中".into(),
                tags: vec![" #Work ".into(), "work".into()],
            },
        )
        .unwrap();
        assert_eq!(draft.tags, vec!["Work"]);

        let note = create_note_in_store(
            &path,
            QuickCaptureNoteInput {
                content: "残すメモ".into(),
                tags: vec!["idea".into()],
                pinned: false,
            },
        )
        .unwrap();
        let updated = update_note_in_store(
            &path,
            note.id.clone(),
            QuickCaptureNoteInput {
                content: "更新済み".into(),
                tags: vec!["done".into()],
                pinned: true,
            },
        )
        .unwrap();
        assert!(updated.pinned);

        let state = load_state_from_store(&path).unwrap();
        assert_eq!(state.draft.content, "途中");
        assert_eq!(state.notes[0].content, "更新済み");
        assert_eq!(state.notes[0].tags, vec!["done"]);

        delete_note_in_store(&path, note.id).unwrap();
        assert!(load_state_from_store(&path).unwrap().notes.is_empty());
        let _ = fs::remove_file(path);
    }

    #[test]
    fn promoting_a_note_clears_the_draft_in_the_same_store_operation() {
        let path = test_path();
        save_draft_in_store(
            &path,
            QuickCaptureDraftInput {
                content: "変換前の下書き".into(),
                tags: vec!["inbox".into()],
            },
        )
        .unwrap();

        let promotion = promote_note_in_store(
            &path,
            QuickCaptureNoteInput {
                content: "保存するメモ".into(),
                tags: vec!["work".into()],
                pinned: false,
            },
        )
        .unwrap();

        assert_eq!(promotion.note.content, "保存するメモ");
        assert_eq!(promotion.draft.content, "");
        let state = load_state_from_store(&path).unwrap();
        assert_eq!(state.notes.len(), 1);
        assert_eq!(state.notes[0].id, promotion.note.id);
        assert_eq!(state.draft.content, "");
        assert!(state.draft.tags.is_empty());
        let _ = fs::remove_file(path);
    }

    #[test]
    fn empty_notes_and_missing_ids_are_rejected() {
        let path = test_path();
        let error = create_note_in_store(
            &path,
            QuickCaptureNoteInput {
                content: "  ".into(),
                tags: vec![],
                pinned: false,
            },
        )
        .unwrap_err();
        assert!(error.contains("本文"));
        assert!(delete_note_in_store(&path, "missing".into()).is_err());
        let _ = fs::remove_file(path);
    }

    #[test]
    fn attachments_are_copied_and_deleted() {
        let path = test_path();
        let data_dir = path.with_extension("data");
        let source = path.with_extension("txt");
        fs::write(&source, "添付内容").unwrap();
        let note = create_note_in_store(
            &path,
            QuickCaptureNoteInput {
                content: "添付メモ".into(),
                tags: vec![],
                pinned: false,
            },
        )
        .unwrap();
        let attachment = add_attachment_in_store(
            &path,
            &data_dir,
            QuickCaptureAttachmentInput {
                note_id: note.id.clone(),
                source_path: source.to_string_lossy().to_string(),
            },
        )
        .unwrap();
        assert_eq!(
            fs::read_to_string(&attachment.stored_path).unwrap(),
            "添付内容"
        );
        assert_eq!(
            load_state_from_store(&path).unwrap().notes[0]
                .attachments
                .len(),
            1
        );
        delete_attachment_in_store(&path, note.id, attachment.id).unwrap();
        assert!(load_state_from_store(&path).unwrap().notes[0]
            .attachments
            .is_empty());
        let _ = fs::remove_file(path);
        let _ = fs::remove_file(source);
        let _ = fs::remove_dir_all(data_dir);
    }

    #[test]
    fn markdown_export_writes_tags() {
        let path = test_path().with_extension("md");
        export_quick_capture_markdown(QuickCaptureExportInput {
            path: path.to_string_lossy().to_string(),
            content: "# 見出し".into(),
            tags: vec!["work".into()],
        })
        .unwrap();
        let output = fs::read_to_string(&path).unwrap();
        assert!(output.contains("# 見出し"));
        assert!(output.contains("Tags: #work"));
        let _ = fs::remove_file(path);
    }
}
