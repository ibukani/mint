use serde::{Deserialize, Serialize};
use std::path::PathBuf;

pub struct QuickCaptureStoreState {
    pub(crate) path: PathBuf,
    pub(crate) data_dir: PathBuf,
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
