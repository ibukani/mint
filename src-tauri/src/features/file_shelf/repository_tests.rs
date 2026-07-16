use super::super::clipboard::{
    capture_clipboard_image_in_store, capture_clipboard_text_explicit_in_store,
    capture_clipboard_text_in_store, clear_clipboard_history_in_store, is_application_ignored,
    should_monitor_clipboard,
};
use super::super::shortcut::{
    is_double_shortcut_press, shortcut_hold_duration, SHORTCUT_LONG_PRESS_INTERVAL,
};
use super::super::window::shelf_vertical_offset;
use super::*;
use crate::core::settings::{FileShelfSettings, FileShelfVerticalPosition};
use std::{
    path::PathBuf,
    time::{Duration as StdDuration, Instant},
};

fn test_paths(name: &str) -> (PathBuf, PathBuf) {
    let root = std::env::temp_dir().join(format!("mint-file-shelf-{name}-{}", Uuid::new_v4()));
    fs::create_dir_all(&root).unwrap();
    (root.join("shelf.sqlite3"), root)
}

#[test]
fn ignored_applications_match_executable_names_without_case_sensitivity() {
    let mut settings = FileShelfSettings::default();
    settings
        .ignored_applications
        .push(r#"C:\Tools\PrivateCopy.exe"#.to_string());

    assert!(is_application_ignored(&settings, Some("bitWARDEN.EXE")));
    assert!(is_application_ignored(
        &settings,
        Some(r#"C:\Tools\PrivateCopy.exe"#)
    ));
    assert!(!is_application_ignored(&settings, Some("explorer.exe")));
    assert!(!is_application_ignored(&settings, None));
}

#[test]
fn safe_contact_links_are_urls_and_executable_schemes_are_rejected() {
    let (database, root) = test_paths("contact-links");
    open_store(&database).unwrap();

    let mutation = add_content_in_store(
        &database,
        &root,
        AddFileShelfContentInput::Url {
            url: "mailto:hello@example.com".to_string(),
        },
    )
    .unwrap();
    let item = &mutation.state.groups[0].items[0];
    assert_eq!(item.kind, FileShelfItemKind::Url);
    assert_eq!(item.display_name, "hello@example.com");

    let error = add_content_in_store(
        &database,
        &root,
        AddFileShelfContentInput::Url {
            url: "javascript:alert(1)".to_string(),
        },
    )
    .unwrap_err();
    assert!(error.contains("mailto"));
    let _ = fs::remove_dir_all(root);
}

#[test]
fn groups_multiple_paths_and_skips_duplicates() {
    let (database, root) = test_paths("paths");
    let first = root.join("first.txt");
    let second = root.join("second.txt");
    fs::write(&first, "one").unwrap();
    fs::write(&second, "two").unwrap();
    open_store(&database).unwrap();

    let mutation = add_paths_in_store(
        &database,
        AddFileShelfPathsInput {
            paths: vec![
                first.to_string_lossy().to_string(),
                second.to_string_lossy().to_string(),
                first.to_string_lossy().to_string(),
            ],
        },
    )
    .unwrap();

    assert_eq!(mutation.added_count, 2);
    assert_eq!(mutation.skipped_count, 1);
    assert_eq!(mutation.state.groups.len(), 1);
    assert_eq!(mutation.state.groups[0].items.len(), 2);
    let _ = fs::remove_dir_all(root);
}

#[test]
fn image_paths_produce_safe_inline_previews() {
    let (database, root) = test_paths("image-preview");
    let image = root.join("reference.png");
    fs::write(&image, b"png-preview").unwrap();
    open_store(&database).unwrap();
    let mutation = add_paths_in_store(
        &database,
        AddFileShelfPathsInput {
            paths: vec![image.to_string_lossy().to_string()],
        },
    )
    .unwrap();
    let item = &mutation.state.groups[0].items[0];

    assert_eq!(item.kind, FileShelfItemKind::Image);
    assert_eq!(item.mime_type.as_deref(), Some("image/png"));
    let preview = load_preview_from_store(&database, &item.id).unwrap();
    assert!(preview
        .data_url
        .as_deref()
        .is_some_and(|value| value.starts_with("data:image/png;base64,")));
    assert!(load_preview_from_store(&database, "missing-item").is_err());
    let _ = fs::remove_dir_all(root);
}

#[test]
fn shelf_vertical_positions_use_the_available_monitor_height() {
    assert_eq!(
        shelf_vertical_offset(&FileShelfVerticalPosition::Top, 500, None, 100),
        0
    );
    assert_eq!(
        shelf_vertical_offset(&FileShelfVerticalPosition::Center, 500, None, 100),
        250
    );
    assert_eq!(
        shelf_vertical_offset(&FileShelfVerticalPosition::Bottom, 500, None, 100),
        500
    );
    assert_eq!(
        shelf_vertical_offset(&FileShelfVerticalPosition::Cursor, 500, Some(300), 100),
        250
    );
    assert_eq!(
        shelf_vertical_offset(&FileShelfVerticalPosition::Cursor, 500, Some(20), 100),
        0
    );
    assert_eq!(
        shelf_vertical_offset(&FileShelfVerticalPosition::Cursor, 500, Some(580), 100),
        500
    );
    assert_eq!(
        shelf_vertical_offset(&FileShelfVerticalPosition::Cursor, 500, None, 100),
        250
    );
}

#[test]
fn removal_can_be_restored() {
    let (database, root) = test_paths("undo");
    let file = root.join("item.txt");
    fs::write(&file, "item").unwrap();
    open_store(&database).unwrap();
    let mutation = add_paths_in_store(
        &database,
        AddFileShelfPathsInput {
            paths: vec![file.to_string_lossy().to_string()],
        },
    )
    .unwrap();
    let id = mutation.state.groups[0].items[0].id.clone();
    let removal = remove_items_in_store(&database, vec![id]).unwrap();
    assert!(removal.state.groups.is_empty());
    let restored = restore_removal_in_store(&database, removal.undo_token).unwrap();
    assert_eq!(restored.groups.len(), 1);
    let _ = fs::remove_dir_all(root);
}

#[test]
fn recent_removals_can_be_recalled_one_batch_at_a_time() {
    let (database, root) = test_paths("recent-removal");
    let first = root.join("first.txt");
    let second = root.join("second.txt");
    fs::write(&first, "first").unwrap();
    fs::write(&second, "second").unwrap();
    open_store(&database).unwrap();
    let first_mutation = add_paths_in_store(
        &database,
        AddFileShelfPathsInput {
            paths: vec![first.to_string_lossy().to_string()],
        },
    )
    .unwrap();
    let first_id = first_mutation.state.groups[0].items[0].id.clone();
    remove_items_in_store(&database, vec![first_id]).unwrap();
    let second_mutation = add_paths_in_store(
        &database,
        AddFileShelfPathsInput {
            paths: vec![second.to_string_lossy().to_string()],
        },
    )
    .unwrap();
    let second_id = second_mutation.state.groups[0].items[0].id.clone();
    remove_items_in_store(&database, vec![second_id]).unwrap();

    let first_recall = restore_recent_removal_in_store(&database).unwrap();
    assert_eq!(first_recall.groups.len(), 1);
    assert_eq!(first_recall.groups[0].items[0].display_name, "second.txt");
    let second_recall = restore_recent_removal_in_store(&database).unwrap();
    assert_eq!(second_recall.groups.len(), 2);
    assert!(restore_recent_removal_in_store(&database).is_err());
    let _ = fs::remove_dir_all(root);
}

#[test]
fn pinned_items_survive_removal_until_unpinned() {
    let (database, root) = test_paths("pinning");
    let file = root.join("reference.txt");
    fs::write(&file, "reference").unwrap();
    open_store(&database).unwrap();
    let mutation = add_paths_in_store(
        &database,
        AddFileShelfPathsInput {
            paths: vec![file.to_string_lossy().to_string()],
        },
    )
    .unwrap();
    let id = mutation.state.groups[0].items[0].id.clone();

    let pinned = set_items_pinned_in_store(&database, vec![id.clone()], true).unwrap();
    assert!(pinned.groups[0].items[0].pinned);
    assert!(remove_items_in_store(&database, vec![id.clone()]).is_err());
    assert_eq!(load_state_from_store(&database).unwrap().groups.len(), 1);

    set_items_pinned_in_store(&database, vec![id.clone()], false).unwrap();
    let removal = remove_items_in_store(&database, vec![id]).unwrap();
    assert!(removal.state.groups.is_empty());
    let _ = fs::remove_dir_all(root);
}

#[test]
fn shelf_labels_can_change_without_renaming_the_source_file() {
    let (database, root) = test_paths("rename-label");
    let file = root.join("original-name.txt");
    fs::write(&file, "reference").unwrap();
    open_store(&database).unwrap();
    let mutation = add_paths_in_store(
        &database,
        AddFileShelfPathsInput {
            paths: vec![file.to_string_lossy().to_string()],
        },
    )
    .unwrap();
    let id = mutation.state.groups[0].items[0].id.clone();
    let source_path = mutation.state.groups[0].items[0].source_path.clone();

    let renamed = rename_item_in_store(&database, id.clone(), "  提出用  ".to_string()).unwrap();
    assert_eq!(renamed.groups[0].items[0].display_name, "提出用");
    assert_eq!(renamed.groups[0].items[0].source_path, source_path);
    assert!(file.exists());
    assert!(rename_item_in_store(&database, id.clone(), "\n".to_string()).is_err());
    assert!(rename_item_in_store(&database, id, "x".repeat(121)).is_err());
    let _ = fs::remove_dir_all(root);
}

#[test]
fn managed_asset_check_rejects_paths_outside_the_shelf_directory() {
    let root = PathBuf::from("/mint-data");
    let assets = root.join("file_shelf_assets");

    assert!(is_managed_asset(&assets.join("pasted.png"), &assets));
    assert!(!is_managed_asset(&root.join("settings.json"), &assets));
    assert!(!is_managed_asset(
        &assets.join("nested").join("pasted.png"),
        &assets,
    ));
}

#[test]
fn clipboard_history_deduplicates_and_prunes_without_touching_manual_items() {
    let (database, root) = test_paths("clipboard-history");
    let file = root.join("manual.txt");
    fs::write(&file, "manual").unwrap();
    open_store(&database).unwrap();
    add_paths_in_store(
        &database,
        AddFileShelfPathsInput {
            paths: vec![file.to_string_lossy().to_string()],
        },
    )
    .unwrap();

    for index in 0..6 {
        capture_clipboard_text_in_store(&database, format!("history {index}"), 5).unwrap();
    }
    let duplicate = capture_clipboard_text_in_store(&database, "history 2".to_string(), 5).unwrap();

    assert_eq!(duplicate.added_count, 0);
    assert_eq!(duplicate.state.groups.len(), 6);
    assert_eq!(
        duplicate.state.groups[0].items[0].text_content.as_deref(),
        Some("history 2")
    );
    assert_eq!(
        duplicate
            .state
            .groups
            .iter()
            .flat_map(|group| &group.items)
            .filter(|item| item.source == FileShelfItemSource::ClipboardHistory)
            .count(),
        5
    );
    assert!(duplicate
        .state
        .groups
        .iter()
        .flat_map(|group| &group.items)
        .any(|item| item.source == FileShelfItemSource::Manual));

    let cleared = clear_clipboard_history_in_store(&database).unwrap();
    assert_eq!(cleared.state.groups.len(), 1);
    assert_eq!(
        cleared.state.groups[0].items[0].source,
        FileShelfItemSource::Manual
    );
    let _ = fs::remove_dir_all(root);
}

#[test]
fn explicit_clipboard_capture_is_deduplicated_and_promotes_history() {
    let (database, root) = test_paths("explicit-clipboard");
    open_store(&database).unwrap();
    capture_clipboard_text_in_store(&database, "https://example.com".to_string(), 25).unwrap();

    let promoted =
        capture_clipboard_text_explicit_in_store(&database, "https://example.com".to_string())
            .unwrap();
    assert_eq!(promoted.added_count, 1);
    assert_eq!(
        promoted.state.groups[0].items[0].source,
        FileShelfItemSource::Manual
    );

    let duplicate =
        capture_clipboard_text_explicit_in_store(&database, "https://example.com".to_string())
            .unwrap();
    assert_eq!(duplicate.added_count, 0);
    assert_eq!(duplicate.skipped_count, 1);

    assert!(clear_clipboard_history_in_store(&database).is_err());
    assert_eq!(load_state_from_store(&database).unwrap().groups.len(), 1);
    let _ = fs::remove_dir_all(root);
}

#[test]
fn clipboard_images_are_encoded_as_managed_png_files() {
    let (database, root) = test_paths("explicit-clipboard-image");
    let assets = root.join("assets");
    fs::create_dir_all(&assets).unwrap();
    open_store(&database).unwrap();

    let mutation = capture_clipboard_image_in_store(
        &database,
        &assets,
        &[255, 0, 0, 255, 0, 255, 0, 255],
        2,
        1,
    )
    .unwrap();
    let item = &mutation.state.groups[0].items[0];
    assert_eq!(item.kind, FileShelfItemKind::Image);
    assert_eq!(item.source, FileShelfItemSource::Manual);
    assert!(item
        .source_path
        .as_ref()
        .is_some_and(|path| Path::new(path).exists()));
    assert!(capture_clipboard_image_in_store(&database, &assets, &[0; 4], 2, 1).is_err());
    let _ = fs::remove_dir_all(root);
}

#[test]
fn shortcut_double_press_uses_a_bounded_interval() {
    let start = Instant::now();
    let mut previous = None;
    assert!(!is_double_shortcut_press(&mut previous, start));
    assert!(is_double_shortcut_press(
        &mut previous,
        start + StdDuration::from_millis(400)
    ));
    assert!(previous.is_none());
    assert!(!is_double_shortcut_press(
        &mut previous,
        start + StdDuration::from_millis(1_000)
    ));
    assert!(!is_double_shortcut_press(
        &mut previous,
        start + StdDuration::from_millis(1_700)
    ));
}

#[test]
fn shortcut_long_press_requires_eight_hundred_milliseconds() {
    let start = Instant::now();
    let mut pressed_at = Some(start);
    assert_eq!(
        shortcut_hold_duration(&mut pressed_at, start + StdDuration::from_millis(799)),
        Some(StdDuration::from_millis(799))
    );
    assert!(pressed_at.is_none());

    pressed_at = Some(start);
    assert!(
        shortcut_hold_duration(&mut pressed_at, start + SHORTCUT_LONG_PRESS_INTERVAL)
            .is_some_and(|duration| duration >= SHORTCUT_LONG_PRESS_INTERVAL)
    );
}

#[test]
fn existing_shelf_database_migrates_items_to_manual_source() {
    let (database, root) = test_paths("origin-migration");
    let connection = Connection::open(&database).unwrap();
    connection
            .execute_batch(
                "PRAGMA foreign_keys = ON;
                 CREATE TABLE file_shelf_groups (
                   id TEXT PRIMARY KEY NOT NULL,
                   created_at TEXT NOT NULL
                 );
                 CREATE TABLE file_shelf_items (
                   id TEXT PRIMARY KEY NOT NULL,
                   group_id TEXT NOT NULL REFERENCES file_shelf_groups(id) ON DELETE CASCADE,
                   kind TEXT NOT NULL,
                   display_name TEXT NOT NULL,
                   source_path TEXT,
                   text_content TEXT,
                   mime_type TEXT,
                   size_bytes INTEGER,
                   created_at TEXT NOT NULL,
                   removed_at TEXT,
                   removal_token TEXT
                 );
                 INSERT INTO file_shelf_groups(id, created_at) VALUES('group', '2026-07-13T00:00:00Z');
                 INSERT INTO file_shelf_items(
                   id, group_id, kind, display_name, text_content, created_at
                 ) VALUES('item', 'group', 'text', 'saved text', 'saved text', '2026-07-13T00:00:00Z');",
            )
            .unwrap();
    drop(connection);

    open_store(&database).unwrap();
    let state = load_state_from_store(&database).unwrap();
    assert_eq!(state.groups[0].items[0].source, FileShelfItemSource::Manual);
    assert!(!state.groups[0].items[0].pinned);
    let _ = fs::remove_dir_all(root);
}

#[test]
fn clipboard_monitor_requires_explicit_opt_in() {
    let mut settings = FileShelfSettings::default();
    assert!(!should_monitor_clipboard(&settings));

    settings.clipboard_history_enabled = true;
    assert!(should_monitor_clipboard(&settings));

    settings.enabled = false;
    assert!(!should_monitor_clipboard(&settings));
}
