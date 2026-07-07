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
                .with_handler(|app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        features::clock::toggle_clock_overlay(app);
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
                    if !settings.clock.shortcut.is_empty() {
                        if let Err(e) = app
                            .global_shortcut()
                            .register(settings.clock.shortcut.as_str())
                        {
                            eprintln!("Failed to register clock shortcut: {}", e);
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
