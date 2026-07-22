use serde::{Deserialize, Serialize};
use std::{path::PathBuf, sync::Mutex, time::Instant};

pub struct FileShelfStoreState {
    pub(crate) path: PathBuf,
    pub(crate) assets_dir: PathBuf,
}

#[derive(Default)]
pub struct FileShelfWindowState(pub(crate) Mutex<bool>);

#[derive(Default)]
pub(crate) struct FileShelfShortcutTiming {
    pub(crate) last_pressed_at: Option<Instant>,
    pub(crate) current_pressed_at: Option<Instant>,
}

#[derive(Default)]
pub struct FileShelfShortcutState(pub(crate) Mutex<FileShelfShortcutTiming>);

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum FileShelfItemKind {
    File,
    Folder,
    Image,
    Text,
    Url,
}

impl FileShelfItemKind {
    pub(crate) fn as_str(&self) -> &'static str {
        match self {
            Self::File => "file",
            Self::Folder => "folder",
            Self::Image => "image",
            Self::Text => "text",
            Self::Url => "url",
        }
    }

    pub(crate) fn from_str(value: &str) -> Result<Self, String> {
        match value {
            "file" => Ok(Self::File),
            "folder" => Ok(Self::Folder),
            "image" => Ok(Self::Image),
            "text" => Ok(Self::Text),
            "url" => Ok(Self::Url),
            _ => Err(format!("Unknown file shelf item kind: {value}")),
        }
    }

    pub(crate) fn has_path(&self) -> bool {
        matches!(self, Self::File | Self::Folder | Self::Image)
    }
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum FileShelfAvailability {
    Ready,
    Missing,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum FileShelfItemSource {
    Manual,
    ClipboardHistory,
}

impl FileShelfItemSource {
    pub(crate) fn as_str(&self) -> &'static str {
        match self {
            Self::Manual => "manual",
            Self::ClipboardHistory => "clipboardHistory",
        }
    }

    pub(crate) fn from_str(value: &str) -> Result<Self, String> {
        match value {
            "manual" => Ok(Self::Manual),
            "clipboardHistory" => Ok(Self::ClipboardHistory),
            _ => Err(format!("Unknown file shelf item source: {value}")),
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileShelfItem {
    pub id: String,
    pub group_id: String,
    pub kind: FileShelfItemKind,
    pub display_name: String,
    pub source_path: Option<String>,
    pub text_content: Option<String>,
    pub mime_type: Option<String>,
    pub size_bytes: Option<u64>,
    pub created_at: String,
    pub availability: FileShelfAvailability,
    pub source: FileShelfItemSource,
    pub pinned: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileShelfGroup {
    pub id: String,
    pub created_at: String,
    pub items: Vec<FileShelfItem>,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileShelfState {
    pub groups: Vec<FileShelfGroup>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddFileShelfPathsInput {
    pub paths: Vec<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum AddFileShelfContentInput {
    Text {
        text: String,
    },
    Url {
        url: String,
    },
    Image {
        file_name: String,
        mime_type: String,
        data_base64: String,
    },
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileShelfMutation {
    pub state: FileShelfState,
    pub added_count: usize,
    pub skipped_count: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileShelfRemoval {
    pub state: FileShelfState,
    pub undo_token: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileShelfPreview {
    pub data_url: Option<String>,
}
