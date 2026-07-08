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
                            if shortcut_str == settings.clock.shortcut {
                                features::clock::toggle_clock_overlay(app);
                            } else if shortcut_str == settings.voice_to_text.shortcut {
                                println!("Voice to text triggered via global shortcut!");
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
                    let clock_shortcut = settings.clock.shortcut.trim();
                    let v2t_shortcut = settings.voice_to_text.shortcut.trim();

                    if !clock_shortcut.is_empty() && clock_shortcut != v2t_shortcut {
                        if let Err(e) = app
                            .global_shortcut()
                            .register(clock_shortcut)
                        {
                            eprintln!("Failed to register clock shortcut: {}", e);
                        }
                    }

                    if !v2t_shortcut.is_empty() && clock_shortcut != v2t_shortcut {
                        if let Err(e) = app
                            .global_shortcut()
                            .register(v2t_shortcut)
                        {
                            eprintln!("Failed to register voice_to_text shortcut: {}", e);
                        }
                    }

                    if !clock_shortcut.is_empty() && clock_shortcut == v2t_shortcut {
                        eprintln!("Warning: Global shortcuts are duplicated in settings. Not registering to prevent conflict.");
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
