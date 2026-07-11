mod core;
mod features;

use std::sync::Mutex;
use tauri::{Manager, WindowEvent};
use tauri_plugin_global_shortcut::ShortcutState;

use core::settings::AppSettingsState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
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
                    if event.state == ShortcutState::Pressed {
                        // Read settings from the in-memory cache; fall back to disk if empty
                        let settings_opt = {
                            let state = app.state::<AppSettingsState>();
                            let cached = state.0.lock().unwrap().clone();
                            cached
                        };
                        let settings = match settings_opt {
                            Some(s) => s,
                            None => match core::settings::load_settings_internal(app) {
                                Ok(s) => s,
                                Err(_) => return,
                            },
                        };
                        for (feature, keys) in settings.active_shortcuts() {
                            if let Ok(parsed_keys) = keys.parse::<tauri_plugin_global_shortcut::Shortcut>() {
                                if shortcut == &parsed_keys {
                                    match feature {
                                        "settings" => {
                                            if let Some(main_window) = app.get_webview_window("main") {
                                                let _ = main_window.show();
                                                let _ = main_window.unminimize();
                                                let _ = main_window.set_focus();
                                            }
                                        }
                                        "clock" => features::clock::toggle_clock_overlay(app),
                                        "calendar" => features::calendar::toggle_calendar_overlay(app),
                                        "calendarCreateEvent" => {
                                            features::calendar::open_calendar_event_editor(app)
                                        }
                                        "voiceToText" => features::v2t::handle_voice_to_text_shortcut(app),
                                        _ => {}
                                    }
                                }
                            } else if shortcut.to_string() == keys {
                                match feature {
                                    "settings" => {
                                        if let Some(main_window) = app.get_webview_window("main") {
                                            let _ = main_window.show();
                                            let _ = main_window.unminimize();
                                            let _ = main_window.set_focus();
                                        }
                                    }
                                    "clock" => features::clock::toggle_clock_overlay(app),
                                    "calendar" => features::calendar::toggle_calendar_overlay(app),
                                    "calendarCreateEvent" => {
                                        features::calendar::open_calendar_event_editor(app)
                                    }
                                    "voiceToText" => features::v2t::handle_voice_to_text_shortcut(app),
                                    _ => {}
                                }
                            }
                        }
                    }
                })
                .build(),
        )
        .manage(AppSettingsState(Mutex::new(None)))
        .setup(|app| {
            let calendar_store = features::calendar::initialize_store(app.handle())?;
            app.manage(calendar_store);

            // Initialize system tray
            core::tray::init_tray(app)?;

            // Pre-populate settings cache and register global shortcuts asynchronously
            // so that we don't block window creation.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match core::settings::load_settings_internal(&handle) {
                    Ok(settings) => {
                        // Pre-populate the in-memory cache
                        {
                            let state = handle.state::<AppSettingsState>();
                            *state.0.lock().unwrap() = Some(settings.clone());
                        }

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
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            core::settings::load_settings,
            core::settings::save_settings,
            core::settings::load_api_key,
            core::settings::save_api_key,
            features::calendar::list_calendar_events,
            features::calendar::get_next_calendar_event,
            features::calendar::create_calendar_event,
            features::calendar::update_calendar_event,
            features::calendar::delete_calendar_event,
            features::v2t::transcribe_audio_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
