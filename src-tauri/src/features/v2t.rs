use crate::core::settings::{load_api_key, VoiceToTextSettings};
use reqwest::{multipart, StatusCode};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

const API_SERVICE: &str = "voice_to_text";
const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const TRANSCRIPTION_TIMEOUT: Duration = Duration::from_secs(10 * 60);
const MAX_RECORDING_BYTES: usize = 25 * 1024 * 1024;

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionResult {
    pub text: String,
}

#[derive(Deserialize, Debug)]
struct TranscriptionApiResponse {
    text: String,
}

fn transcription_url(base_url: &str) -> Result<url::Url, String> {
    let value = format!("{}/audio/transcriptions", base_url.trim_end_matches('/'));
    let url = url::Url::parse(&value)
        .map_err(|_| "有効なAPIエンドポイントURLを入力してください。".to_string())?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("APIエンドポイントはhttp://またはhttps://で指定してください。".to_string());
    }
    Ok(url)
}

fn validate_common_settings(settings: &VoiceToTextSettings) -> Result<(), String> {
    if !settings.enabled {
        return Err("音声入力を有効にしてください。".to_string());
    }
    if settings.status != "available" {
        return Err("この環境では音声入力を利用できません。".to_string());
    }
    if settings.base_url.trim().is_empty() {
        return Err("APIエンドポイントURLを入力してください。".to_string());
    }
    if settings.model.trim().is_empty() {
        return Err("音声認識モデル名を入力してください。".to_string());
    }
    Ok(())
}

fn validate_settings(settings: &VoiceToTextSettings, audio_file_path: &str) -> Result<(), String> {
    validate_common_settings(settings)?;
    if audio_file_path.trim().is_empty() {
        return Err("音声ファイルを選択してください。".to_string());
    }
    if !Path::new(audio_file_path).is_file() {
        return Err(
            "音声ファイルが見つかりません。移動または削除されていないか確認してください。"
                .to_string(),
        );
    }
    Ok(())
}

fn validate_recording(settings: &VoiceToTextSettings, audio_data: &[u8]) -> Result<(), String> {
    validate_common_settings(settings)?;
    if audio_data.is_empty() {
        return Err("録音データがありません。もう一度録音してください。".to_string());
    }
    if audio_data.len() > MAX_RECORDING_BYTES {
        return Err("録音データが25MBを超えています。短い音声で再試行してください。".to_string());
    }
    Ok(())
}

fn api_error_message(status: StatusCode) -> String {
    match status.as_u16() {
        401 | 403 => {
            "音声認識APIの認証に失敗しました。APIキーとアクセス権限を確認してください。"
                .to_string()
        }
        404 => {
            "音声認識APIが見つかりません。エンドポイントURLとモデル名を確認してください。"
                .to_string()
        }
        413 => "音声ファイルがAPIの受付可能サイズを超えています。".to_string(),
        429 => {
            "音声認識APIの利用上限に達しました。時間を置いて再試行してください。".to_string()
        }
        500..=599 => {
            "音声認識APIで一時的な問題が発生しました。時間を置いて再試行してください。"
                .to_string()
        }
        code => format!(
            "音声認識APIがリクエストを処理できませんでした（HTTP {code}）。接続設定を確認してください。"
        ),
    }
}

fn request_error_message(error: &reqwest::Error) -> String {
    if error.is_timeout() {
        "文字起こしがタイムアウトしました。短い音声で再試行するか、APIの状態を確認してください。"
            .to_string()
    } else if error.is_connect() {
        "音声認識APIへ接続できませんでした。ネットワークとエンドポイントURLを確認してください。"
            .to_string()
    } else {
        "音声ファイルをAPIへ送信できませんでした。時間を置いて再試行してください。".to_string()
    }
}

fn recording_file_name(file_name: &str) -> String {
    let candidate = Path::new(file_name)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("mint-recording.webm");
    let extension = Path::new(candidate)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if matches!(
        extension.as_str(),
        "aac" | "flac" | "m4a" | "mp3" | "ogg" | "wav" | "webm"
    ) {
        candidate.to_string()
    } else {
        "mint-recording.webm".to_string()
    }
}

fn recording_mime_type(file_name: &str) -> &'static str {
    match Path::new(file_name)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "ogg" => "audio/ogg",
        "wav" => "audio/wav",
        "mp3" => "audio/mpeg",
        "m4a" => "audio/mp4",
        "aac" => "audio/aac",
        "flac" => "audio/flac",
        _ => "audio/webm",
    }
}

async fn send_transcription_request(
    settings: &VoiceToTextSettings,
    form: multipart::Form,
) -> Result<TranscriptionResult, String> {
    let endpoint = transcription_url(&settings.base_url)?;

    let api_key = load_api_key(API_SERVICE.to_string())?;
    if api_key.trim().is_empty() {
        return Err("APIキーを入力してください。".to_string());
    }

    let client = reqwest::Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(TRANSCRIPTION_TIMEOUT)
        .build()
        .map_err(|_| "音声認識APIへの接続を準備できませんでした。".to_string())?;
    let response = client
        .post(endpoint)
        .bearer_auth(api_key)
        .multipart(form)
        .send()
        .await
        .map_err(|error| request_error_message(&error))?;

    let status = response.status();
    if !status.is_success() {
        return Err(api_error_message(status));
    }

    let body = response
        .json::<TranscriptionApiResponse>()
        .await
        .map_err(|_| "音声認識APIの結果を読み取れませんでした。".to_string())?;
    let text = body.text.trim();
    if text.is_empty() {
        return Err("音声認識APIから文字起こし結果が返されませんでした。".to_string());
    }

    Ok(TranscriptionResult {
        text: text.to_string(),
    })
}

#[tauri::command]
pub async fn transcribe_audio_file(
    settings: VoiceToTextSettings,
    audio_file_path: String,
) -> Result<TranscriptionResult, String> {
    validate_settings(&settings, &audio_file_path)?;

    let mut form = reqwest::multipart::Form::new()
        .text("model", settings.model.trim().to_string())
        .file("file", &audio_file_path)
        .await
        .map_err(|_| {
            "音声ファイルを読み込めませんでした。ファイルのアクセス権を確認してください。"
                .to_string()
        })?;

    let language = settings.language.trim();
    if !language.is_empty() {
        form = form.text("language", language.to_string());
    }

    send_transcription_request(&settings, form).await
}

#[tauri::command]
pub async fn transcribe_audio_recording(
    settings: VoiceToTextSettings,
    audio_data: Vec<u8>,
    file_name: String,
) -> Result<TranscriptionResult, String> {
    validate_recording(&settings, &audio_data)?;
    let safe_file_name = recording_file_name(&file_name);
    let part = multipart::Part::bytes(audio_data)
        .file_name(safe_file_name.clone())
        .mime_str(recording_mime_type(&safe_file_name))
        .map_err(|_| "録音データの形式を準備できませんでした。".to_string())?;
    let form = multipart::Form::new()
        .text("model", settings.model.trim().to_string())
        .part("file", part);
    let form = if settings.language.trim().is_empty() {
        form
    } else {
        form.text("language", settings.language.trim().to_string())
    };

    send_transcription_request(&settings, form).await
}

pub fn handle_voice_to_text_shortcut(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }

    if let Err(e) = app.emit_to("main", "voice-to-text-shortcut", ()) {
        eprintln!("Failed to emit voice-to-text shortcut event: {}", e);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_a_normalized_transcription_endpoint() {
        let endpoint = transcription_url("https://api.example.com/v1///").unwrap();
        assert_eq!(
            endpoint.as_str(),
            "https://api.example.com/v1/audio/transcriptions"
        );
    }

    #[test]
    fn rejects_non_http_transcription_endpoints() {
        assert!(transcription_url("file:///tmp/api").is_err());
    }

    #[test]
    fn maps_api_failures_to_actionable_messages() {
        assert!(api_error_message(StatusCode::UNAUTHORIZED).contains("APIキー"));
        assert!(api_error_message(StatusCode::PAYLOAD_TOO_LARGE).contains("サイズ"));
        assert!(api_error_message(StatusCode::TOO_MANY_REQUESTS).contains("利用上限"));
        assert!(api_error_message(StatusCode::BAD_GATEWAY).contains("一時的"));
    }

    #[test]
    fn validates_an_existing_audio_path() {
        let settings = VoiceToTextSettings {
            enabled: true,
            ..VoiceToTextSettings::default()
        };
        let source_file =
            std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src/features/v2t.rs");

        assert!(validate_settings(&settings, source_file.to_str().unwrap()).is_ok());
        assert!(validate_settings(&settings, "/missing/audio.wav").is_err());
    }

    #[test]
    fn validates_recording_size_and_normalizes_file_names() {
        let settings = VoiceToTextSettings {
            enabled: true,
            ..VoiceToTextSettings::default()
        };

        assert!(validate_recording(&settings, b"audio").is_ok());
        assert!(validate_recording(&settings, &vec![0; MAX_RECORDING_BYTES + 1]).is_err());
        assert_eq!(recording_file_name("/tmp/recording.webm"), "recording.webm");
        assert_eq!(recording_file_name("recording.exe"), "mint-recording.webm");
        assert_eq!(recording_mime_type("recording.ogg"), "audio/ogg");
    }
}
