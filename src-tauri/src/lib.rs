mod core;
mod features;

use tauri::WindowEvent;
use tauri_plugin_global_shortcut::ShortcutState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        let shortcut_str = shortcut.to_string();
                        if let Ok(settings) = core::settings::load_settings_internal(app) {
                            for (feature, keys) in settings.active_shortcuts() {
                                if shortcut_str == keys {
                                    match feature {
                                        "clock" => features::clock::toggle_clock_overlay(app),
                                        "voiceToText" => {
                                            println!("Voice to text triggered via global shortcut!")
                                        }
                                        _ => {}
                                    }
                                }
                            }
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            // Initialize system tray
            core::tray::init_tray(app)?;

            // Load settings and register global shortcuts
            let handle = app.handle().clone();
            match core::settings::load_settings_internal(&handle) {
                Ok(settings) => {
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
                                if let Err(e) = app.global_shortcut().register(key) {
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
