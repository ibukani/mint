use chrono::{SecondsFormat, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use std::{collections::HashSet, fs, path::Path, time::Duration};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

use super::models::{
    QuickCaptureAttachment, QuickCaptureDraft, QuickCaptureDraftInput, QuickCaptureNote,
    QuickCaptureNoteInput, QuickCapturePromotion, QuickCaptureState, QuickCaptureStoreState,
};

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

pub fn load_quick_capture_state(
    state: tauri::State<'_, QuickCaptureStoreState>,
) -> Result<QuickCaptureState, String> {
    load_state_from_store(&state.path)
}

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

#[cfg(test)]
mod tests {
    use super::super::{
        attachments::{add_attachment_in_store, delete_attachment_in_store},
        backup::export_quick_capture_markdown,
        models::{QuickCaptureAttachmentInput, QuickCaptureExportInput},
    };
    use super::*;
    use std::path::PathBuf;

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
