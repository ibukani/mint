mod core;
mod features;

use std::sync::Arc;
use std::sync::Mutex;
use tauri::{Emitter, Listener, Manager, RunEvent, WindowEvent};
use tauri_plugin_global_shortcut::ShortcutState;

use core::settings::AppSettingsState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let clipboard_monitor = Arc::new(features::file_shelf::ClipboardHistoryMonitor::new());
    let clipboard_monitor_for_event = clipboard_monitor.clone();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_drag::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    // Read settings from the in-memory cache; fall back to disk if empty.
                    let settings_opt = {
                        let state = app.state::<AppSettingsState>();
                        let cached = state.0.lock().unwrap().clone();
                        cached
                    };
                    let settings = match settings_opt {
                        Some(settings) => settings,
                        None => match core::settings::load_settings_internal(app) {
                            Ok(settings) => settings,
                            Err(_) => return,
                        },
                    };
                    for (feature, keys) in settings.active_shortcuts() {
                        let matched = keys
                            .parse::<tauri_plugin_global_shortcut::Shortcut>()
                            .map(|parsed| shortcut == &parsed)
                            .unwrap_or_else(|_| shortcut.to_string() == keys);
                        if !matched {
                            continue;
                        }
                        if feature == "fileShelf" {
                            features::file_shelf::handle_file_shelf_shortcut_event(
                                app,
                                &settings.file_shelf,
                                event.state,
                            );
                            continue;
                        }
                        if event.state != ShortcutState::Pressed {
                            continue;
                        }
                        match feature {
                            "settings" => {
                                core::window::show_main_window(app);
                            }
                            "clock" => features::clock::toggle_clock_overlay(app),
                            "calendar" => features::calendar::toggle_calendar_overlay(app),
                            "gameLauncher" => {
                                features::game_launcher::toggle_game_launcher_overlay(app)
                            }
                            "quickCapture" => {
                                features::quick_capture::toggle_quick_capture_overlay(app)
                            }
                            "calendarCreateEvent" => {
                                features::calendar::open_calendar_event_editor(app)
                            }
                            "voiceToText" => features::v2t::handle_voice_to_text_shortcut(app),
                            _ => {}
                        }
                    }
                })
                .build(),
        )
        .manage(AppSettingsState(Mutex::new(None)))
        .setup(move |app| {
            let calendar_store = features::calendar::initialize_store(app.handle())?;
            app.manage(calendar_store);
            let quick_capture_store = features::quick_capture::initialize_store(app.handle())?;
            app.manage(quick_capture_store);
            let file_shelf_store = features::file_shelf::initialize_store(app.handle())?;
            app.manage(file_shelf_store);
            let clipboard_monitor_for_settings = clipboard_monitor.clone();
            let handle_for_clipboard_settings = app.handle().clone();
            app.listen("clipboard-settings-changed", move |_| {
                if let Ok(settings) = core::settings::load_settings_cached(
                    &handle_for_clipboard_settings,
                ) {
                    features::file_shelf::configure_clipboard_history_monitor(
                        handle_for_clipboard_settings.clone(),
                        clipboard_monitor_for_settings.clone(),
                        &settings.file_shelf,
                    );
                }
            });
            app.manage(features::google_calendar::GoogleCalendarState::default());

            // Add ready event listener for calendar editor window to resolve timing issues
            let handle_for_ready = app.handle().clone();
            app.listen("calendar-editor-ready", move |_event| {
                if let Some(editor) = handle_for_ready.get_webview_window("calendarEditor") {
                    if let Some(state) = handle_for_ready.try_state::<features::calendar::window::CalendarEditorState>() {
                        if let Ok(guard) = state.0.lock() {
                            if let Some(payload) = guard.as_ref() {
                                let _ = editor.emit("calendar-editor-shown", payload.clone());
                            }
                        }
                    }
                }
            });

            // Initialize system tray
            core::tray::init_tray(app)?;

            // Pre-populate settings cache and register global shortcuts asynchronously
            // so that we don't block window creation.
            let handle = app.handle().clone();
            let clipboard_monitor_for_start = clipboard_monitor.clone();
            tauri::async_runtime::spawn(async move {
                match core::settings::load_settings_internal(&handle) {
                    Ok(settings) => {
                        features::file_shelf::configure_clipboard_history_monitor(
                            handle.clone(),
                            clipboard_monitor_for_start,
                            &settings.file_shelf,
                        );
                        if let Err(error) =
                            core::settings::sync_autostart(&handle, settings.autostart)
                        {
                            eprintln!("Failed to synchronize autostart setting: {}", error);
                        }

                        // Pre-populate the in-memory cache
                        {
                            let state = handle.state::<AppSettingsState>();
                            *state.0.lock().unwrap() = Some(settings.clone());
                        }

                        features::file_shelf::apply_window_settings(
                            &handle,
                            &settings.file_shelf,
                        );
                        features::file_shelf::apply_clipboard_history_settings(
                            &handle,
                            &settings.file_shelf,
                        );

                        use tauri_plugin_global_shortcut::GlobalShortcutExt;
                        let shortcuts = settings.active_shortcuts();

                        // Check for duplicates
                        let mut unique_keys = std::collections::HashSet::new();
                        let mut has_duplicates = false;
                        for (_, key) in &shortcuts {
                            if !unique_keys.insert(*key) {
                                has_duplicates = true;
                                break;
                            }
                        }

                        if has_duplicates {
                            eprintln!(
                                "Warning: Global shortcuts are duplicated in settings. Not registering to prevent conflict."
                            );
                        } else {
                            for (feature, key) in shortcuts {
                                if !key.is_empty() {
                                    if let Err(e) = handle.global_shortcut().register(key) {
                                        eprintln!("Failed to register {} shortcut: {}", feature, e);
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("Failed to load settings for shortcuts: {}", e);
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let label = window.label();
                if label == "main"
                    || label == "clock"
                    || label == "calendar"
                    || label == "gameLauncher"
                    || label == "quickCapture"
                    || label == "fileShelf"
                {
                    api.prevent_close();
                    let _ = window.hide();
                    if label == "fileShelf" {
                        if let Some(state) = window
                            .app_handle()
                            .try_state::<features::file_shelf::FileShelfWindowState>()
                        {
                            *state.0.lock().unwrap_or_else(|value| value.into_inner()) = false;
                        }
                    }
                }
            }
        })
        .manage(features::calendar::window::CalendarEditorState::default())
        .manage(features::game_launcher::scan::GameScanCache::default())
        .manage(features::file_shelf::FileShelfWindowState::default())
        .manage(features::file_shelf::FileShelfShortcutState::default())
        .invoke_handler(tauri::generate_handler![
            core::settings::load_settings,
            core::settings::save_settings,
            core::settings::load_api_key,
            core::settings::save_api_key,
            core::window::open_overlay,
            core::window::overlay_ready,
            features::calendar::repository::list_calendar_events,
            features::calendar::repository::get_next_calendar_event,
            features::calendar::repository::create_calendar_event,
            features::calendar::repository::update_calendar_event,
            features::calendar::repository::delete_calendar_event,
            features::calendar::window::open_calendar_editor_window,
            features::calendar::window::get_calendar_editor_payload,
            features::google_calendar::auth::get_google_calendar_connection,
            features::google_calendar::auth::connect_google_calendar,
            features::google_calendar::auth::list_google_calendars,
            features::google_calendar::sync::sync_google_calendars,
            features::google_calendar::auth::disconnect_google_calendar,
            features::v2t::transcribe_audio_file,
            features::v2t::transcribe_audio_recording,
            features::game_launcher::scan::list_installed_games,
            features::game_launcher::launch::launch_game,
            features::quick_capture::load_quick_capture_state,
            features::quick_capture::save_quick_capture_draft,
            features::quick_capture::promote_quick_capture_note,
            features::quick_capture::create_quick_capture_note,
            features::quick_capture::update_quick_capture_note,
            features::quick_capture::delete_quick_capture_note,
            features::quick_capture::restore_quick_capture_note,
            features::quick_capture::add_quick_capture_attachment,
            features::quick_capture::delete_quick_capture_attachment,
            features::quick_capture::export_quick_capture_markdown,
            features::quick_capture::export_quick_capture_backup,
            features::quick_capture::import_quick_capture_backup,
            features::file_shelf::load_file_shelf_state,
            features::file_shelf::load_file_shelf_preview,
            features::file_shelf::rename_file_shelf_item,
            features::file_shelf::add_file_shelf_paths,
            features::file_shelf::add_file_shelf_content,
            features::file_shelf::remove_file_shelf_items,
            features::file_shelf::set_file_shelf_items_pinned,
            features::file_shelf::restore_file_shelf_removal,
            features::file_shelf::restore_recent_file_shelf_removal,
            features::file_shelf::clear_file_shelf,
            features::file_shelf::clear_file_shelf_clipboard_history,
            features::file_shelf::should_auto_expand_file_shelf,
            features::file_shelf::set_file_shelf_expanded,
            features::game_launcher::launch::open_game_store_page,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(move |_app, event| {
        if let RunEvent::Exit = event {
            clipboard_monitor_for_event.stop();
        }
    });
}
