use rusqlite::{params, OptionalExtension};
use std::{fs, path::Path};
use uuid::Uuid;

use super::{
    models::{QuickCaptureAttachment, QuickCaptureAttachmentInput},
    repository::{open_store, timestamp},
};

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

pub(super) fn add_attachment_in_store(
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

pub(super) fn delete_attachment_in_store(
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
