use chrono::{SecondsFormat, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::Path,
    time::Duration,
};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

use super::models::{
    QuickCaptureAttachment, QuickCaptureDraft, QuickCaptureDraftInput, QuickCaptureNote,
    QuickCaptureNoteInput, QuickCapturePromotion, QuickCaptureState, QuickCaptureStoreState,
};

pub(super) fn initialize_store(app: &AppHandle) -> Result<QuickCaptureStoreState, String> {
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
    purge_expired_deleted_notes(&state.path)?;
    Ok(state)
}

pub(super) fn open_store(path: &Path) -> Result<Connection, String> {
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
             CREATE TABLE IF NOT EXISTS quick_capture_deleted_notes (
               id TEXT PRIMARY KEY NOT NULL,
               note_json TEXT NOT NULL,
               deleted_at TEXT NOT NULL
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

pub(super) fn timestamp() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

pub(super) fn normalize_tags(tags: Vec<String>) -> Vec<String> {
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

fn read_tags_by_note(connection: &Connection) -> Result<HashMap<String, Vec<String>>, String> {
    let mut statement = connection
        .prepare(
            "SELECT note_id, tag FROM quick_capture_note_tags
             ORDER BY note_id, tag COLLATE NOCASE",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    let mut tags_by_note = HashMap::new();
    for (note_id, tag) in rows {
        tags_by_note
            .entry(note_id)
            .or_insert_with(Vec::new)
            .push(tag);
    }
    Ok(tags_by_note)
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

fn read_tags_for_note(connection: &Connection, note_id: &str) -> Result<Vec<String>, String> {
    let mut statement = connection
        .prepare(
            "SELECT tag FROM quick_capture_note_tags
             WHERE note_id = ?1 ORDER BY tag COLLATE NOCASE",
        )
        .map_err(|error| error.to_string())?;
    let tags = statement
        .query_map([note_id], |row| row.get(0))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string());
    tags
}

fn read_note_by_id(connection: &Connection, note_id: &str) -> Result<QuickCaptureNote, String> {
    let row = connection
        .query_row(
            "SELECT id, content, pinned, created_at, updated_at
             FROM quick_capture_notes WHERE id = ?1",
            [note_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, bool>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                ))
            },
        )
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "メモが見つかりません。".to_string())?;
    Ok(QuickCaptureNote {
        id: row.0,
        content: row.1,
        pinned: row.2,
        created_at: row.3,
        updated_at: row.4,
        tags: read_tags_for_note(connection, note_id)?,
        attachments: read_attachments(connection, note_id)?,
    })
}

fn read_attachments_by_note(
    connection: &Connection,
) -> Result<HashMap<String, Vec<QuickCaptureAttachment>>, String> {
    let mut statement = connection
        .prepare(
            "SELECT note_id, id, file_name, mime_type, size_bytes, stored_path, created_at
             FROM quick_capture_attachments ORDER BY note_id, created_at DESC",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                QuickCaptureAttachment {
                    id: row.get(1)?,
                    file_name: row.get(2)?,
                    mime_type: row.get(3)?,
                    size_bytes: row.get(4)?,
                    stored_path: row.get(5)?,
                    created_at: row.get(6)?,
                },
            ))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    let mut attachments_by_note = HashMap::new();
    for (note_id, attachment) in rows {
        attachments_by_note
            .entry(note_id)
            .or_insert_with(Vec::new)
            .push(attachment);
    }
    Ok(attachments_by_note)
}

pub(super) fn load_state_from_store(path: &Path) -> Result<QuickCaptureState, String> {
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
    let mut tags_by_note = read_tags_by_note(&connection)?;
    let mut attachments_by_note = read_attachments_by_note(&connection)?;
    let notes = rows
        .into_iter()
        .map(|(id, content, pinned, created_at, updated_at)| {
            Ok(QuickCaptureNote {
                tags: tags_by_note.remove(&id).unwrap_or_default(),
                attachments: attachments_by_note.remove(&id).unwrap_or_default(),
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

pub(super) fn load_quick_capture_state(
    state: tauri::State<'_, QuickCaptureStoreState>,
) -> Result<QuickCaptureState, String> {
    load_state_from_store(&state.path)
}

pub(super) fn save_quick_capture_draft(
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

pub(super) fn promote_quick_capture_note(
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

pub(super) fn create_quick_capture_note(
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

pub(super) fn update_quick_capture_note(
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

pub(super) fn delete_quick_capture_note(
    id: String,
    state: tauri::State<'_, QuickCaptureStoreState>,
) -> Result<(), String> {
    delete_note_in_store(&state.path, id)
}

fn delete_note_in_store(path: &Path, id: String) -> Result<(), String> {
    let mut connection = open_store(path)?;
    let note = read_note_by_id(&connection, &id)?;
    let note_json = serde_json::to_string(&note).map_err(|error| error.to_string())?;
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    transaction
        .execute(
            "INSERT INTO quick_capture_deleted_notes(id, note_json, deleted_at)
             VALUES(?1, ?2, ?3)
             ON CONFLICT(id) DO UPDATE SET note_json = excluded.note_json,
               deleted_at = excluded.deleted_at",
            params![id, note_json, timestamp()],
        )
        .map_err(|error| error.to_string())?;
    let changed = transaction
        .execute("DELETE FROM quick_capture_notes WHERE id = ?1", [&id])
        .map_err(|error| error.to_string())?;
    if changed == 0 {
        return Err("メモが見つかりません。".to_string());
    }
    // Keep attachment files until the undo window expires. The startup
    // cleanup below removes abandoned trash after 30 days.
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(())
}

pub(super) fn restore_quick_capture_note(
    id: String,
    state: tauri::State<'_, QuickCaptureStoreState>,
) -> Result<QuickCaptureNote, String> {
    restore_note_in_store(&state.path, id)
}

fn restore_note_in_store(path: &Path, id: String) -> Result<QuickCaptureNote, String> {
    let mut connection = open_store(path)?;
    let note_json = connection
        .query_row(
            "SELECT note_json FROM quick_capture_deleted_notes WHERE id = ?1",
            [&id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "取り消せる削除履歴が見つかりません。".to_string())?;
    let note: QuickCaptureNote =
        serde_json::from_str(&note_json).map_err(|error| error.to_string())?;
    if note.id != id {
        return Err("削除履歴のメモIDが一致しません。".to_string());
    }
    for attachment in &note.attachments {
        if !Path::new(&attachment.stored_path).is_file() {
            return Err(format!(
                "添付ファイル {} が見つからないため復元できません。",
                attachment.file_name
            ));
        }
    }
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    let exists: bool = transaction
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM quick_capture_notes WHERE id = ?1)",
            [&id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if exists {
        return Err("同じIDのメモがすでに存在します。".to_string());
    }
    transaction
        .execute(
            "INSERT INTO quick_capture_notes(id, content, pinned, created_at, updated_at)
             VALUES(?1, ?2, ?3, ?4, ?5)",
            params![
                note.id,
                note.content,
                note.pinned,
                note.created_at,
                note.updated_at
            ],
        )
        .map_err(|error| error.to_string())?;
    for tag in normalize_tags(note.tags.clone()) {
        transaction
            .execute(
                "INSERT INTO quick_capture_note_tags(note_id, tag) VALUES(?1, ?2)",
                params![note.id, tag],
            )
            .map_err(|error| error.to_string())?;
    }
    for attachment in &note.attachments {
        transaction
            .execute(
                "INSERT INTO quick_capture_attachments(
                   id, note_id, file_name, mime_type, size_bytes, stored_path, created_at
                 ) VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    attachment.id,
                    note.id,
                    attachment.file_name,
                    attachment.mime_type,
                    attachment.size_bytes,
                    attachment.stored_path,
                    attachment.created_at,
                ],
            )
            .map_err(|error| error.to_string())?;
    }
    transaction
        .execute(
            "DELETE FROM quick_capture_deleted_notes WHERE id = ?1",
            [&id],
        )
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(note)
}

fn purge_expired_deleted_notes(path: &Path) -> Result<(), String> {
    let connection = open_store(path)?;
    let cutoff = (Utc::now() - chrono::Duration::days(30)).to_rfc3339();
    let mut statement = connection
        .prepare(
            "SELECT id, note_json FROM quick_capture_deleted_notes
             WHERE deleted_at < ?1",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([cutoff.clone()], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    drop(statement);
    for (_, note_json) in rows {
        if let Ok(note) = serde_json::from_str::<QuickCaptureNote>(&note_json) {
            for attachment in note.attachments {
                let _ = fs::remove_file(attachment.stored_path);
            }
        }
    }
    connection
        .execute(
            "DELETE FROM quick_capture_deleted_notes WHERE deleted_at < ?1",
            [cutoff],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(test)]
#[path = "repository_tests.rs"]
mod tests;
