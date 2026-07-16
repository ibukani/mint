use super::clipboard::clear_clipboard_history_in_store;
use super::models::{
    AddFileShelfContentInput, AddFileShelfPathsInput, FileShelfMutation, FileShelfPreview,
    FileShelfRemoval, FileShelfState, FileShelfStoreState,
};
use super::repository;

pub(super) fn load_file_shelf_state(
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfState, String> {
    repository::load_state_from_store(&state.path)
}

pub(super) fn load_file_shelf_preview(
    item_id: String,
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfPreview, String> {
    repository::load_preview_from_store(&state.path, &item_id)
}

pub(super) fn add_file_shelf_paths(
    input: AddFileShelfPathsInput,
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfMutation, String> {
    repository::add_paths_in_store(&state.path, input)
}

pub(super) fn add_file_shelf_content(
    input: AddFileShelfContentInput,
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfMutation, String> {
    repository::add_content_in_store(&state.path, &state.assets_dir, input)
}

pub(super) fn remove_file_shelf_items(
    item_ids: Vec<String>,
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfRemoval, String> {
    repository::remove_items_in_store(&state.path, item_ids)
}

pub(super) fn set_file_shelf_items_pinned(
    item_ids: Vec<String>,
    pinned: bool,
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfState, String> {
    repository::set_items_pinned_in_store(&state.path, item_ids, pinned)
}

pub(super) fn rename_file_shelf_item(
    item_id: String,
    display_name: String,
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfState, String> {
    repository::rename_item_in_store(&state.path, item_id, display_name)
}

pub(super) fn restore_file_shelf_removal(
    undo_token: String,
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfState, String> {
    repository::restore_removal_in_store(&state.path, undo_token)
}

pub(super) fn restore_recent_file_shelf_removal(
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfState, String> {
    repository::restore_recent_removal_in_store(&state.path)
}

pub(super) fn clear_file_shelf(
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfRemoval, String> {
    let current = repository::load_state_from_store(&state.path)?;
    let ids = current
        .groups
        .into_iter()
        .flat_map(|group| {
            group
                .items
                .into_iter()
                .filter(|item| !item.pinned)
                .map(|item| item.id)
        })
        .collect();
    repository::remove_items_in_store(&state.path, ids)
}

pub(super) fn clear_file_shelf_clipboard_history(
    state: tauri::State<'_, FileShelfStoreState>,
) -> Result<FileShelfRemoval, String> {
    clear_clipboard_history_in_store(&state.path)
}
