mod core;
mod features;

use std::sync::Mutex;
use tauri::{Emitter, Listener, Manager, RunEvent, WindowEvent};
use tauri_plugin_global_shortcut::ShortcutState;

use core::settings::AppSettingsState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .arg("--autostart")
                .app_name(core::environment::autostart_app_name())
                .build(),
        )
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

                            "calendarCreateEvent" => {
                                features::calendar::open_calendar_event_editor(app)
                            }
                            "mintPalette" => features::mint_palette::toggle_mint_palette_overlay(app),
                            _ => {}
                        }
                    }
                })
                .build(),
        )
        .manage(AppSettingsState(Mutex::new(None)))
        .manage(crate::core::performance::PerformanceRegistry::default())
        .setup(move |app| {
            crate::core::performance::record_event(
                app.handle(),
                "app:startup",
                None,
                None,
                std::collections::HashMap::new(),
            );
            if let Ok(monitors) = app.available_monitors() {
                crate::core::performance::set_counter(
                    app.handle(),
                    "monitorsDetected",
                    monitors.len() as u64,
                );
            }
            let calendar_store = features::calendar::initialize_store(app.handle())?;
            app.manage(calendar_store);
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
            tauri::async_runtime::spawn(async move {
                match core::settings::load_settings_internal(&handle) {
                    Ok(settings) => {
                        if let Err(error) =
                            core::settings::sync_autostart(&handle, settings.autostart)
                        {
                            eprintln!("Failed to synchronize autostart setting: {}", error);
                            crate::core::performance::record_error(
                                &handle,
                                &format!("Failed to synchronize autostart setting: {error}"),
                            );
                        }

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
                            crate::core::performance::record_error(
                                &handle,
                                "Global shortcuts are duplicated in settings.",
                            );
                        } else {
                            for (feature, key) in shortcuts {
                                if !key.is_empty() {
                                    if let Err(e) = handle.global_shortcut().register(key) {
                                        eprintln!(
                                            "Failed to register {} shortcut: {}",
                                            feature, e
                                        );
                                        crate::core::performance::record_error(
                                            &handle,
                                            &format!(
                                                "Failed to register {feature} shortcut: {e}"
                                            ),
                                        );
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("Failed to load settings for shortcuts: {}", e);
                        crate::core::performance::record_error(
                            &handle,
                            &format!("Failed to load settings for shortcuts: {e}"),
                        );
                    }
                }
            });

            let is_autostart = std::env::args().any(|arg| arg == "--autostart");
            if !is_autostart {
                if let Some(main_window) = app.get_webview_window("main") {
                    let _ = main_window.show();
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let label = window.label();
                if label == "main"
                    || label == "clock"
                    || label == "calendar"
                    || label == "gameLauncher"
                {
                    let _ = core::window_state::persist_now(window.app_handle(), label);
                    api.prevent_close();
                    let _ = window.hide();

                    crate::core::performance::record_event(
                        window.app_handle(),
                        "window:hidden",
                        Some(label),
                        None,
                        std::collections::HashMap::new(),
                    );
                    crate::core::performance::increment_counter(
                        window.app_handle(),
                        "windowsHidden",
                    );
                }
            } else if let WindowEvent::Destroyed = event {
                crate::core::performance::record_event(
                    window.app_handle(),
                    "window:destroyed",
                    Some(window.label()),
                    None,
                    std::collections::HashMap::new(),
                );
                crate::core::performance::increment_counter(
                    window.app_handle(),
                    "windowsDestroyed",
                );
            } else if matches!(event, WindowEvent::Moved(_) | WindowEvent::Resized(_)) {
                core::window_state::maybe_persist(window.app_handle(), window.label());
            }
        })
        .manage(features::calendar::window::CalendarEditorState::default())
        .manage(features::game_launcher::scan::GameScanCache::default())
        .invoke_handler(tauri::generate_handler![
            core::settings::load_settings,
            core::settings::save_settings,
            core::performance::collect_diagnostics,
            core::window::open_overlay,
            core::window::overlay_ready,
            core::window::open_settings_tab,
            core::window::take_pending_settings_tab,
            core::window_state::reset_window_state,
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
            features::game_launcher::scan::list_installed_games,
            features::game_launcher::scan::get_game_source_status,
            features::game_launcher::launch::launch_game,
            features::game_launcher::launch::open_game_store_page,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(move |app, event| {
        if let RunEvent::Exit = event {
            core::window_state::flush_all(app);
        }
    });
}
