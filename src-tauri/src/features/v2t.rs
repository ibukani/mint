use crate::core::settings::{load_api_key, VoiceToTextSettings};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{AppHandle, Emitter, Manager};

const API_SERVICE: &str = "voice_to_text";

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionResult {
    pub text: String,
}

#[derive(Deserialize, Debug)]
struct TranscriptionApiResponse {
    text: String,
}

fn transcription_url(base_url: &str) -> String {
    format!("{}/audio/transcriptions", base_url.trim_end_matches('/'))
}

fn validate_settings(settings: &VoiceToTextSettings, audio_file_path: &str) -> Result<(), String> {
    if !settings.enabled {
        return Err("Voice to Text is disabled.".to_string());
    }
    if settings.status != "available" {
        return Err("Voice to Text is not available.".to_string());
    }
    if settings.base_url.trim().is_empty() {
        return Err("Base URL is required.".to_string());
    }
    if settings.model.trim().is_empty() {
        return Err("Model is required.".to_string());
    }
    if audio_file_path.trim().is_empty() {
        return Err("Audio file path is required.".to_string());
    }
    if !Path::new(audio_file_path).is_file() {
        return Err("Audio file does not exist.".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn transcribe_audio_file(
    settings: VoiceToTextSettings,
    audio_file_path: String,
) -> Result<TranscriptionResult, String> {
    validate_settings(&settings, &audio_file_path)?;

    let api_key = load_api_key(API_SERVICE.to_string())?;
    if api_key.trim().is_empty() {
        return Err("API key is required.".to_string());
    }

    let mut form = reqwest::blocking::multipart::Form::new()
        .text("model", settings.model.trim().to_string())
        .file("file", &audio_file_path)
        .map_err(|e| e.to_string())?;

    let language = settings.language.trim();
    if !language.is_empty() {
        form = form.text("language", language.to_string());
    }

    let response = reqwest::blocking::Client::new()
        .post(transcription_url(&settings.base_url))
        .bearer_auth(api_key)
        .multipart(form)
        .send()
        .map_err(|e| e.to_string())?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().unwrap_or_else(|_| String::new());
        let message = if body.trim().is_empty() {
            format!("Transcription API failed with status {}", status)
        } else {
            format!("Transcription API failed with status {}: {}", status, body)
        };
        return Err(message);
    }

    let body = response
        .json::<TranscriptionApiResponse>()
        .map_err(|e| e.to_string())?;

    Ok(TranscriptionResult { text: body.text })
}

pub fn handle_voice_to_text_shortcut(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }

    if let Err(e) = app.emit_to("main", "voice-to-text-shortcut", ()) {
        eprintln!("Failed to emit voice-to-text shortcut event: {}", e);
    }
}
