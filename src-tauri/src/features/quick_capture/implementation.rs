use tauri::{AppHandle, State};

use super::{
    models::{
        QuickCaptureDraft, QuickCaptureDraftInput, QuickCaptureNote, QuickCaptureNoteInput,
        QuickCapturePromotion, QuickCaptureState, QuickCaptureStoreState,
    },
    repository,
};

pub fn initialize_store(app: &AppHandle) -> Result<QuickCaptureStoreState, String> {
    repository::initialize_store(app)
}

pub(super) fn load_quick_capture_state(
    state: State<'_, QuickCaptureStoreState>,
) -> Result<QuickCaptureState, String> {
    repository::load_quick_capture_state(state)
}

pub(super) fn save_quick_capture_draft(
    input: QuickCaptureDraftInput,
    state: State<'_, QuickCaptureStoreState>,
) -> Result<QuickCaptureDraft, String> {
    repository::save_quick_capture_draft(input, state)
}

pub(super) fn promote_quick_capture_note(
    input: QuickCaptureNoteInput,
    state: State<'_, QuickCaptureStoreState>,
) -> Result<QuickCapturePromotion, String> {
    repository::promote_quick_capture_note(input, state)
}

pub(super) fn create_quick_capture_note(
    input: QuickCaptureNoteInput,
    state: State<'_, QuickCaptureStoreState>,
) -> Result<QuickCaptureNote, String> {
    repository::create_quick_capture_note(input, state)
}

pub(super) fn update_quick_capture_note(
    id: String,
    input: QuickCaptureNoteInput,
    state: State<'_, QuickCaptureStoreState>,
) -> Result<QuickCaptureNote, String> {
    repository::update_quick_capture_note(id, input, state)
}

pub(super) fn delete_quick_capture_note(
    id: String,
    state: State<'_, QuickCaptureStoreState>,
) -> Result<(), String> {
    repository::delete_quick_capture_note(id, state)
}

pub(super) fn restore_quick_capture_note(
    id: String,
    state: State<'_, QuickCaptureStoreState>,
) -> Result<QuickCaptureNote, String> {
    repository::restore_quick_capture_note(id, state)
}
