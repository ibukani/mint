use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{Read, Write},
    path::Path,
};
use zip::{write::SimpleFileOptions, ZipArchive, ZipWriter};

use super::{
    implementation::{load_state_from_store, normalize_tags, open_store},
    models::{QuickCaptureExportInput, QuickCaptureState, QuickCaptureStoreState},
};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct QuickCaptureBackup {
    version: u32,
    state: QuickCaptureState,
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
    fs::write(input.path, markdown).map_err(|error| error.to_string())
}

pub(super) fn export_quick_capture_backup(
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

pub(super) fn import_quick_capture_backup(
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
