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
