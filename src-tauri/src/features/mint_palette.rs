use tauri::{AppHandle, Emitter, Manager};

use crate::core::window::{ensure_overlay_window, OverlayTarget};

pub fn toggle_mint_palette_overlay(app: &AppHandle) {
    if app.get_webview_window("mintPalette").is_none() {
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            if ensure_overlay_window(&app, OverlayTarget::MintPalette).is_ok() {
                toggle_mint_palette_overlay_ready(&app);
            }
        });
        return;
    }
    toggle_mint_palette_overlay_ready(app);
}

fn toggle_mint_palette_overlay_ready(app: &AppHandle) {
    let Ok(window) = ensure_overlay_window(app, OverlayTarget::MintPalette) else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        show_mint_palette_overlay(app);
    }
}

pub fn show_mint_palette_overlay(app: &AppHandle) {
    let Ok(window) = ensure_overlay_window(app, OverlayTarget::MintPalette) else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.set_focus();
        return;
    }
    if crate::core::window::is_initial_show_pending("mintPalette") {
        return;
    }
    let _ = window.center();
    let _ = window.show();
    let _ = window.set_focus();
    let _ = window.emit("mint-palette-shown", ());
}
