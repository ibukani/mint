use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
};
use uuid::Uuid;
use zip::{write::SimpleFileOptions, ZipArchive, ZipWriter};

use super::{
    attachments::MAX_ATTACHMENT_BYTES,
    models::{QuickCaptureExportInput, QuickCaptureState, QuickCaptureStoreState},
    repository::{load_state_from_store, normalize_tags, open_store},
};

const MAX_BACKUP_ATTACHMENT_COUNT: usize = 1_000;
const MAX_BACKUP_TOTAL_BYTES: u64 = 512 * 1024 * 1024;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct QuickCaptureBackup {
    version: u32,
    state: QuickCaptureState,
}

struct PreparedAttachment {
    note_id: String,
    id: String,
    file_name: String,
    mime_type: String,
    size_bytes: u64,
    created_at: String,
    staged_path: PathBuf,
    final_path: PathBuf,
}

fn temporary_path(destination: &Path) -> Result<PathBuf, String> {
    let file_name = destination
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "書き出し先のファイル名を取得できません。".to_string())?;
    let parent = destination.parent().unwrap_or_else(|| Path::new("."));
    Ok(parent.join(format!(".{file_name}.mint-tmp-{}", Uuid::new_v4())))
}

fn replace_file(temp_path: &Path, destination: &Path) -> Result<(), String> {
    let previous_path = temporary_path(destination)?.with_extension("previous");
    let had_previous = destination.exists();
    if had_previous {
        fs::rename(destination, &previous_path).map_err(|error| error.to_string())?;
    }

    match fs::rename(temp_path, destination) {
        Ok(()) => {
            if had_previous {
                let _ = fs::remove_file(previous_path);
            }
            Ok(())
        }
        Err(error) => {
            if had_previous {
                let _ = fs::rename(previous_path, destination);
            }
            Err(error.to_string())
        }
    }
}

fn write_file_atomically(destination: &Path, bytes: &[u8]) -> Result<(), String> {
    let temp_path = temporary_path(destination)?;
    let result = (|| {
        fs::write(&temp_path, bytes).map_err(|error| error.to_string())?;
        replace_file(&temp_path, destination)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp_path);
    }
    result
}

pub(super) fn export_quick_capture_markdown(input: QuickCaptureExportInput) -> Result<(), String> {
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
    write_file_atomically(Path::new(&input.path), markdown.as_bytes())
}

pub(super) fn export_quick_capture_backup(
    path: String,
    state: tauri::State<'_, QuickCaptureStoreState>,
) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("バックアップ先を指定してください。".to_string());
    }
    let destination = Path::new(&path);
    let current = load_state_from_store(&state.path)?;
    let temp_path = temporary_path(destination)?;
    let result = (|| {
        let file = fs::File::create(&temp_path).map_err(|error| error.to_string())?;
        let mut archive = ZipWriter::new(file);
        let options =
            SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
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
        replace_file(&temp_path, destination)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp_path);
    }
    result
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

fn validate_identifier(value: &str, label: &str) -> Result<(), String> {
    Uuid::parse_str(value).map_err(|_| format!("バックアップの{label}が不正です。"))?;
    Ok(())
}

fn validate_backup(backup: &QuickCaptureBackup) -> Result<(), String> {
    if backup.version != 1 {
        return Err("対応していないバックアップ形式です。".to_string());
    }

    let mut note_ids = HashSet::new();
    let mut attachment_ids = HashSet::new();
    let mut attachment_count = 0_usize;
    let mut total_bytes = 0_u64;
    for note in &backup.state.notes {
        validate_identifier(&note.id, "メモID")?;
        if !note_ids.insert(&note.id) {
            return Err("バックアップに同じメモIDが複数あります。".to_string());
        }
        for attachment in &note.attachments {
            validate_identifier(&attachment.id, "添付ID")?;
            if !attachment_ids.insert(&attachment.id) {
                return Err("バックアップに同じ添付IDが複数あります。".to_string());
            }
            attachment_count += 1;
            if attachment_count > MAX_BACKUP_ATTACHMENT_COUNT {
                return Err("バックアップの添付ファイル数が多すぎます。".to_string());
            }
            if attachment.size_bytes > MAX_ATTACHMENT_BYTES {
                return Err("バックアップに100MBを超える添付ファイルがあります。".to_string());
            }
            total_bytes = total_bytes
                .checked_add(attachment.size_bytes)
                .ok_or_else(|| "バックアップの添付ファイル容量が大きすぎます。".to_string())?;
            if total_bytes > MAX_BACKUP_TOTAL_BYTES {
                return Err("バックアップの添付ファイル容量が大きすぎます。".to_string());
            }
            if safe_attachment_name(&attachment.file_name).is_empty() {
                return Err("バックアップの添付ファイル名が不正です。".to_string());
            }
        }
    }
    Ok(())
}

fn prepare_attachments(
    archive: &mut ZipArchive<fs::File>,
    backup: &QuickCaptureBackup,
    staging_root: &Path,
    final_root: &Path,
    import_id: &str,
) -> Result<Vec<PreparedAttachment>, String> {
    let mut prepared = Vec::new();
    for note in &backup.state.notes {
        for attachment in &note.attachments {
            let entry_name = format!("attachments/{}/{}", note.id, attachment.id);
            let entry = archive.by_name(&entry_name).map_err(|error| {
                format!(
                    "添付ファイル {} が見つかりません: {error}",
                    attachment.file_name
                )
            })?;
            let mut bytes = Vec::new();
            entry
                .take(MAX_ATTACHMENT_BYTES + 1)
                .read_to_end(&mut bytes)
                .map_err(|error| error.to_string())?;
            if bytes.len() as u64 != attachment.size_bytes {
                return Err(format!(
                    "添付ファイル {} のサイズがmanifestと一致しません。",
                    attachment.file_name
                ));
            }

            let staged_path = staging_root.join(&note.id).join(&attachment.id);
            if let Some(parent) = staged_path.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            fs::write(&staged_path, bytes).map_err(|error| error.to_string())?;

            let file_name = safe_attachment_name(&attachment.file_name);
            let final_path = final_root
                .join(&note.id)
                .join(format!("{import_id}-{}-{file_name}", attachment.id));
            prepared.push(PreparedAttachment {
                note_id: note.id.clone(),
                id: attachment.id.clone(),
                file_name: attachment.file_name.clone(),
                mime_type: attachment.mime_type.clone(),
                size_bytes: attachment.size_bytes,
                created_at: attachment.created_at.clone(),
                staged_path,
                final_path,
            });
        }
    }
    Ok(prepared)
}

fn cleanup_paths(paths: &[PathBuf]) {
    for path in paths {
        let _ = fs::remove_file(path);
    }
}

fn cleanup_previous_attachments(state: &QuickCaptureState, attachment_root: &Path) {
    for attachment in state.notes.iter().flat_map(|note| &note.attachments) {
        let path = Path::new(&attachment.stored_path);
        if path.starts_with(attachment_root) {
            let _ = fs::remove_file(path);
        }
    }
}

pub(super) fn import_quick_capture_backup(
    path: String,
    state: tauri::State<'_, QuickCaptureStoreState>,
) -> Result<QuickCaptureState, String> {
    import_backup_from_path(Path::new(&path), &state.path, &state.data_dir)
}

fn import_backup_from_path(
    path: &Path,
    database_path: &Path,
    data_dir: &Path,
) -> Result<QuickCaptureState, String> {
    if path.as_os_str().is_empty() {
        return Err("復元するバックアップを指定してください。".to_string());
    }
    let file = fs::File::open(path).map_err(|error| error.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|error| error.to_string())?;
    let manifest_file = archive
        .by_name("manifest.json")
        .map_err(|error| format!("バックアップのmanifestが見つかりません: {error}"))?;
    let mut manifest_bytes = Vec::new();
    manifest_file
        .take(8 * 1024 * 1024)
        .read_to_end(&mut manifest_bytes)
        .map_err(|error| error.to_string())?;
    let backup: QuickCaptureBackup = serde_json::from_slice(&manifest_bytes)
        .map_err(|error| format!("バックアップの形式が不正です: {error}"))?;
    validate_backup(&backup)?;

    let previous = load_state_from_store(database_path)?;
    let import_id = Uuid::new_v4().to_string();
    let staging_root = data_dir.join(format!(".quick_capture_import-{import_id}"));
    let attachment_root = data_dir.join("quick_capture_attachments");
    let final_root = attachment_root.join(format!("import-{import_id}"));
    fs::create_dir_all(&staging_root).map_err(|error| error.to_string())?;

    let mut committed = false;
    let result = (|| {
        let prepared = prepare_attachments(
            &mut archive,
            &backup,
            &staging_root,
            &final_root,
            &import_id,
        )?;
        let mut installed_paths = Vec::with_capacity(prepared.len());
        for attachment in &prepared {
            if let Some(parent) = attachment.final_path.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            fs::rename(&attachment.staged_path, &attachment.final_path)
                .map_err(|error| error.to_string())?;
            installed_paths.push(attachment.final_path.clone());
        }

        let transaction_result = (|| {
            let mut connection = open_store(database_path)?;
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
            for tag in normalize_tags(backup.state.draft.tags.clone()) {
                transaction
                    .execute(
                        "INSERT INTO quick_capture_draft_tags(tag) VALUES(?1)",
                        [tag],
                    )
                    .map_err(|error| error.to_string())?;
            }

            for note in &backup.state.notes {
                transaction
                    .execute(
                        "INSERT INTO quick_capture_notes(id, content, pinned, archived, created_at, updated_at) VALUES(?1, ?2, ?3, ?4, ?5, ?6)",
                        params![
                            note.id,
                            note.content,
                            note.pinned,
                            note.archived,
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
            }
            for attachment in &prepared {
                transaction
                    .execute(
                        "INSERT INTO quick_capture_attachments(id, note_id, file_name, mime_type, size_bytes, stored_path, created_at) VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                        params![
                            attachment.id,
                            attachment.note_id,
                            attachment.file_name,
                            attachment.mime_type,
                            attachment.size_bytes,
                            attachment.final_path.to_string_lossy(),
                            attachment.created_at,
                        ],
                    )
                    .map_err(|error| error.to_string())?;
            }
            transaction.commit().map_err(|error| error.to_string())
        })();

        if let Err(error) = transaction_result {
            cleanup_paths(&installed_paths);
            let _ = fs::remove_dir_all(&final_root);
            return Err(error);
        }

        committed = true;
        cleanup_previous_attachments(&previous, &attachment_root);
        load_state_from_store(database_path)
    })();

    let _ = fs::remove_dir_all(&staging_root);
    if result.is_err() && !committed {
        let _ = fs::remove_dir_all(&final_root);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::quick_capture::{
        models::{QuickCaptureAttachment, QuickCaptureDraft, QuickCaptureNote},
        repository::load_state_from_store,
    };

    fn test_root() -> PathBuf {
        let root =
            std::env::temp_dir().join(format!("mint-quick-capture-backup-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        root
    }

    fn write_backup(path: &Path, backup: &QuickCaptureBackup, attachment_bytes: &[u8]) {
        let file = fs::File::create(path).unwrap();
        let mut archive = ZipWriter::new(file);
        let options = SimpleFileOptions::default();
        for note in &backup.state.notes {
            for attachment in &note.attachments {
                archive
                    .start_file(
                        format!("attachments/{}/{}", note.id, attachment.id),
                        options,
                    )
                    .unwrap();
                archive.write_all(attachment_bytes).unwrap();
            }
        }
        archive.start_file("manifest.json", options).unwrap();
        archive
            .write_all(&serde_json::to_vec(backup).unwrap())
            .unwrap();
        archive.finish().unwrap();
    }

    fn backup_with_note(
        note_id: String,
        attachment: Option<QuickCaptureAttachment>,
    ) -> QuickCaptureBackup {
        QuickCaptureBackup {
            version: 1,
            state: QuickCaptureState {
                draft: QuickCaptureDraft {
                    content: "復元後の下書き".into(),
                    tags: vec![],
                    updated_at: "2026-07-16T00:00:00Z".into(),
                },
                notes: vec![QuickCaptureNote {
                    id: note_id,
                    content: "復元後のメモ".into(),
                    tags: vec![],
                    pinned: false,
                    archived: false,
                    created_at: "2026-07-16T00:00:00Z".into(),
                    updated_at: "2026-07-16T00:00:00Z".into(),
                    attachments: attachment.into_iter().collect(),
                }],
            },
        }
    }

    fn seed_existing_note(database: &Path) -> String {
        let id = Uuid::new_v4().to_string();
        let connection = open_store(database).unwrap();
        connection
            .execute(
                "INSERT INTO quick_capture_notes(id, content, pinned, created_at, updated_at) VALUES(?1, ?2, 0, ?3, ?3)",
                params![id, "残すメモ", "2026-07-16T00:00:00Z"],
            )
            .unwrap();
        id
    }

    #[test]
    fn rejects_path_traversal_ids_without_touching_existing_state() {
        let root = test_root();
        let database = root.join("quick_capture.sqlite3");
        let existing_id = seed_existing_note(&database);
        let backup_path = root.join("malicious.mintbackup");
        write_backup(
            &backup_path,
            &backup_with_note("../../outside".into(), None),
            b"",
        );

        assert!(import_backup_from_path(&backup_path, &database, &root).is_err());
        let state = load_state_from_store(&database).unwrap();
        assert_eq!(state.notes[0].id, existing_id);
        assert_eq!(state.notes[0].content, "残すメモ");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn keeps_existing_state_when_attachment_validation_fails_before_commit() {
        let root = test_root();
        let database = root.join("quick_capture.sqlite3");
        let existing_id = seed_existing_note(&database);
        let backup_path = root.join("invalid-size.mintbackup");
        let attachment_id = Uuid::new_v4().to_string();
        let attachment = QuickCaptureAttachment {
            id: attachment_id,
            file_name: "note.txt".into(),
            mime_type: "text/plain".into(),
            size_bytes: 99,
            stored_path: "ignored-by-import".into(),
            created_at: "2026-07-16T00:00:00Z".into(),
        };
        let backup = backup_with_note(Uuid::new_v4().to_string(), Some(attachment));
        write_backup(&backup_path, &backup, b"too short");

        assert!(import_backup_from_path(&backup_path, &database, &root).is_err());
        let state = load_state_from_store(&database).unwrap();
        assert_eq!(state.notes[0].id, existing_id);
        assert_eq!(state.notes[0].content, "残すメモ");
        let _ = fs::remove_dir_all(root);
    }
}
