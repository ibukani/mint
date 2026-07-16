mod attachments;
mod backup;
mod implementation;
mod models;
mod repository;
mod window;

pub use implementation::initialize_store;
pub use window::toggle_quick_capture_overlay;

pub use models::{
    QuickCaptureAttachment, QuickCaptureAttachmentInput, QuickCaptureDraft, QuickCaptureDraftInput,
    QuickCaptureExportInput, QuickCaptureNote, QuickCaptureNoteInput, QuickCapturePromotion,
    QuickCaptureState, QuickCaptureStoreState,
};

#[tauri::command]
pub fn load_quick_capture_state(
    state: tauri::State<'_, QuickCaptureStoreState>,
) -> Result<QuickCaptureState, String> {
    implementation::load_quick_capture_state(state)
}

#[tauri::command]
pub fn save_quick_capture_draft(
    input: QuickCaptureDraftInput,
    state: tauri::State<'_, QuickCaptureStoreState>,
) -> Result<QuickCaptureDraft, String> {
    implementation::save_quick_capture_draft(input, state)
}

#[tauri::command]
pub fn promote_quick_capture_note(
    input: QuickCaptureNoteInput,
    state: tauri::State<'_, QuickCaptureStoreState>,
) -> Result<QuickCapturePromotion, String> {
    implementation::promote_quick_capture_note(input, state)
}

#[tauri::command]
pub fn create_quick_capture_note(
    input: QuickCaptureNoteInput,
    state: tauri::State<'_, QuickCaptureStoreState>,
) -> Result<QuickCaptureNote, String> {
    implementation::create_quick_capture_note(input, state)
}

#[tauri::command]
pub fn update_quick_capture_note(
    id: String,
    input: QuickCaptureNoteInput,
    state: tauri::State<'_, QuickCaptureStoreState>,
) -> Result<QuickCaptureNote, String> {
    implementation::update_quick_capture_note(id, input, state)
}

#[tauri::command]
pub fn delete_quick_capture_note(
    id: String,
    state: tauri::State<'_, QuickCaptureStoreState>,
) -> Result<(), String> {
    implementation::delete_quick_capture_note(id, state)
}

#[tauri::command]
pub fn add_quick_capture_attachment(
    input: QuickCaptureAttachmentInput,
    state: tauri::State<'_, QuickCaptureStoreState>,
) -> Result<QuickCaptureAttachment, String> {
    attachments::add_attachment_in_store(&state.path, &state.data_dir, input)
}

#[tauri::command]
pub fn delete_quick_capture_attachment(
    note_id: String,
    attachment_id: String,
    state: tauri::State<'_, QuickCaptureStoreState>,
) -> Result<(), String> {
    attachments::delete_attachment_in_store(&state.path, note_id, attachment_id)
}

#[tauri::command]
pub fn export_quick_capture_markdown(input: QuickCaptureExportInput) -> Result<(), String> {
    backup::export_quick_capture_markdown(input)
}

#[tauri::command]
pub fn export_quick_capture_backup(
    path: String,
    state: tauri::State<'_, QuickCaptureStoreState>,
) -> Result<(), String> {
    backup::export_quick_capture_backup(path, state)
}

#[tauri::command]
pub fn import_quick_capture_backup(
    path: String,
    state: tauri::State<'_, QuickCaptureStoreState>,
) -> Result<QuickCaptureState, String> {
    backup::import_quick_capture_backup(path, state)
}
