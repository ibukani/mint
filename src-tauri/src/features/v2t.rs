use crate::core::settings::{load_api_key, VoiceToTextSettings};
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

const API_SERVICE: &str = "voice_to_text";
const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const TRANSCRIPTION_TIMEOUT: Duration = Duration::from_secs(10 * 60);

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

fn validate_settings(settings: &VoiceToTextSettings, audio_file_path: &str) -> Result<(), String> {
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

#[tauri::command]
pub async fn transcribe_audio_file(
    settings: VoiceToTextSettings,
    audio_file_path: String,
) -> Result<TranscriptionResult, String> {
    validate_settings(&settings, &audio_file_path)?;
    let endpoint = transcription_url(&settings.base_url)?;

    let api_key = load_api_key(API_SERVICE.to_string())?;
    if api_key.trim().is_empty() {
        return Err("APIキーを入力してください。".to_string());
    }

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
}
