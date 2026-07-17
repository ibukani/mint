mod clipboard;
mod implementation;
mod models;
mod repository;
mod shortcut;
mod window;

const COLLAPSED_WIDTH: f64 = 32.0;
const COLLAPSED_HEIGHT: f64 = 96.0;
const EXPANDED_WIDTH: f64 = 360.0;
const EXPANDED_HEIGHT: f64 = 520.0;

pub use clipboard::{
    apply_clipboard_history_settings, configure_clipboard_history_monitor, ClipboardHistoryMonitor,
};
pub use repository::initialize_store;
pub use shortcut::handle_file_shelf_shortcut_event;
pub use window::{apply_window_settings, toggle_file_shelf_overlay};

#[allow(unused_imports)]
pub use models::{
    AddFileShelfContentInput, AddFileShelfPathsInput, FileShelfAvailability, FileShelfGroup,
    FileShelfItem, FileShelfItemKind, FileShelfItemSource, FileShelfMutation, FileShelfPreview,
    FileShelfRemoval, FileShelfShortcutState, FileShelfState, FileShelfStoreState,
    FileShelfWindowState,
};

#[tauri::command]
pub fn load_file_shelf_state(
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfState, String> {
    implementation::load_file_shelf_state(state)
}

#[tauri::command]
pub fn load_file_shelf_preview(
    item_id: String,
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfPreview, String> {
    implementation::load_file_shelf_preview(item_id, state)
}

#[tauri::command]
pub fn add_file_shelf_paths(
    input: AddFileShelfPathsInput,
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfMutation, String> {
    implementation::add_file_shelf_paths(input, state)
}

#[tauri::command]
pub fn add_file_shelf_content(
    input: AddFileShelfContentInput,
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfMutation, String> {
    implementation::add_file_shelf_content(input, state)
}

#[tauri::command]
pub fn remove_file_shelf_items(
    item_ids: Vec<String>,
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfRemoval, String> {
    implementation::remove_file_shelf_items(item_ids, state)
}

#[tauri::command]
pub fn set_file_shelf_items_pinned(
    item_ids: Vec<String>,
    pinned: bool,
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfState, String> {
    implementation::set_file_shelf_items_pinned(item_ids, pinned, state)
}

#[tauri::command]
pub fn rename_file_shelf_item(
    item_id: String,
    display_name: String,
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfState, String> {
    implementation::rename_file_shelf_item(item_id, display_name, state)
}

#[tauri::command]
pub fn restore_file_shelf_removal(
    undo_token: String,
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfState, String> {
    implementation::restore_file_shelf_removal(undo_token, state)
}

#[tauri::command]
pub fn restore_recent_file_shelf_removal(
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfState, String> {
    implementation::restore_recent_file_shelf_removal(state)
}

#[tauri::command]
pub fn clear_file_shelf(
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfRemoval, String> {
    implementation::clear_file_shelf(state)
}

#[tauri::command]
pub fn clear_file_shelf_clipboard_history(
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfRemoval, String> {
    implementation::clear_file_shelf_clipboard_history(state)
}

#[tauri::command]
pub fn should_auto_expand_file_shelf(app: tauri::AppHandle) -> Result<bool, String> {
    shortcut::should_auto_expand_file_shelf(app)
}

#[tauri::command]
pub async fn set_file_shelf_expanded(
    app: tauri::AppHandle,
    expanded: bool,
    focus: bool,
) -> Result<(), String> {
    shortcut::set_file_shelf_expanded(app, expanded, focus)
}
