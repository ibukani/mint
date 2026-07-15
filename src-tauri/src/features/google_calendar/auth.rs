use super::{
    run_blocking,
    sync::{pending_count, stored_sync_status},
    CalendarListResponse, GoogleCalendarConnection, GoogleCalendarInfo, GoogleCalendarState,
    TokenResponse, UserInfoResponse, API_ROOT,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use reqwest::blocking::Client;
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    io::{ErrorKind, Read, Write},
    net::TcpListener,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;
use url::Url;
use uuid::Uuid;

use super::super::calendar::{database::open_store, CalendarStoreState};

const TOKEN_SERVICE: &str = "com.ibuibu.mint.google_calendar";
const TOKEN_USER: &str = "refresh_token";
const ACCOUNT_USER: &str = "account_email";
const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const GOOGLE_CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const GOOGLE_REQUEST_TIMEOUT: Duration = Duration::from_secs(60);

pub(super) fn google_client() -> Result<Client, String> {
    Client::builder()
        .connect_timeout(GOOGLE_CONNECT_TIMEOUT)
        .timeout(GOOGLE_REQUEST_TIMEOUT)
        .build()
        .map_err(|_| "Google Calendarへの接続を準備できませんでした。".to_string())
}

fn client_id() -> Result<&'static str, String> {
    option_env!("GOOGLE_CALENDAR_CLIENT_ID")
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "GOOGLE_CALENDAR_CLIENT_ID is not configured for this build.".to_string())
}

fn credential_entry(user: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(TOKEN_SERVICE, user).map_err(|error| error.to_string())
}

fn token_entry() -> Result<keyring::Entry, String> {
    credential_entry(TOKEN_USER)
}

fn account_entry() -> Result<keyring::Entry, String> {
    credential_entry(ACCOUNT_USER)
}

fn load_refresh_token() -> Result<Option<String>, String> {
    match token_entry()?.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

fn load_account_email() -> Option<String> {
    account_entry().ok()?.get_password().ok()
}

fn write_oauth_response(stream: &mut std::net::TcpStream, status: &str, message: &str) {
    let body = format!(
        "<!doctype html><html lang=\"ja\"><meta charset=\"utf-8\"><title>Mint</title><body><p>{message}</p></body></html>"
    );
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.write_all(response.as_bytes());
}

pub(super) fn refresh_access_token() -> Result<String, String> {
    let refresh_token =
        load_refresh_token()?.ok_or_else(|| "Google Calendar is not connected.".to_string())?;
    let response = google_client()?
        .post(TOKEN_URL)
        .form(&[
            ("client_id", client_id()?),
            ("refresh_token", refresh_token.as_str()),
            ("grant_type", "refresh_token"),
        ])
        .send()
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<TokenResponse>()
        .map_err(|error| error.to_string())?;
    Ok(response.access_token)
}

#[tauri::command]
pub async fn get_google_calendar_connection(
    app: AppHandle,
) -> Result<GoogleCalendarConnection, String> {
    run_blocking(move || {
        let state = app.state::<GoogleCalendarState>();
        let store = app.state::<CalendarStoreState>();
        get_google_calendar_connection_blocking(state.inner(), store.inner())
    })
    .await
}

fn get_google_calendar_connection_blocking(
    state: &GoogleCalendarState,
    store: &CalendarStoreState,
) -> Result<GoogleCalendarConnection, String> {
    let connected = load_refresh_token()?.is_some();
    let (pending_operations, stored_last_synced_at) = stored_sync_status(store)?;
    let status = state
        .status
        .lock()
        .map_err(|_| "Google Calendar state is unavailable.".to_string())?;
    Ok(GoogleCalendarConnection {
        connected,
        account_email: if status.account_email.is_empty() {
            load_account_email().unwrap_or_default()
        } else {
            status.account_email.clone()
        },
        last_synced_at: status.last_synced_at.clone().or(stored_last_synced_at),
        pending_operations,
        error: status.error.clone(),
        syncing: status.syncing,
    })
}

#[tauri::command]
pub async fn connect_google_calendar(app: AppHandle) -> Result<GoogleCalendarConnection, String> {
    run_blocking(move || connect_google_calendar_blocking(app)).await
}

fn connect_google_calendar_blocking(app: AppHandle) -> Result<GoogleCalendarConnection, String> {
    let state = app.state::<GoogleCalendarState>();
    let _operation = state
        .operation
        .lock()
        .map_err(|_| "Google Calendar operation state is unavailable.".to_string())?;
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|error| error.to_string())?;
    listener
        .set_nonblocking(true)
        .map_err(|error| error.to_string())?;
    let redirect_uri = format!(
        "http://127.0.0.1:{}",
        listener
            .local_addr()
            .map_err(|error| error.to_string())?
            .port()
    );
    let verifier = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let csrf_state = Uuid::new_v4().simple().to_string();
    let mut auth_url = Url::parse(AUTH_URL).map_err(|error| error.to_string())?;
    auth_url
        .query_pairs_mut()
        .append_pair("client_id", client_id()?)
        .append_pair("redirect_uri", &redirect_uri)
        .append_pair("response_type", "code")
        .append_pair(
            "scope",
            "openid email https://www.googleapis.com/auth/calendar",
        )
        .append_pair("access_type", "offline")
        .append_pair("prompt", "consent")
        .append_pair("code_challenge", &challenge)
        .append_pair("code_challenge_method", "S256")
        .append_pair("state", &csrf_state);
    app.opener()
        .open_url(auth_url.as_str(), None::<&str>)
        .map_err(|error| error.to_string())?;
    let deadline = Instant::now() + Duration::from_secs(120);
    let (mut stream, _) = loop {
        match listener.accept() {
            Ok(connection) => break connection,
            Err(error) if error.kind() == ErrorKind::WouldBlock && Instant::now() < deadline => {
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(error) if error.kind() == ErrorKind::WouldBlock => {
                return Err("Google authorization timed out.".to_string());
            }
            Err(error) => return Err(error.to_string()),
        }
    };
    stream
        .set_read_timeout(Some(Duration::from_secs(120)))
        .map_err(|error| error.to_string())?;
    let mut buffer = [0_u8; 8192];
    let read = stream
        .read(&mut buffer)
        .map_err(|error| error.to_string())?;
    let request = String::from_utf8_lossy(&buffer[..read]);
    let target = request
        .split_whitespace()
        .nth(1)
        .ok_or_else(|| "Invalid OAuth callback.".to_string())?;
    let callback =
        Url::parse(&format!("http://127.0.0.1{target}")).map_err(|error| error.to_string())?;
    let query: HashMap<_, _> = callback.query_pairs().into_owned().collect();
    if query.get("state") != Some(&csrf_state) {
        write_oauth_response(
            &mut stream,
            "400 Bad Request",
            "認証情報を確認できませんでした。Mintに戻って接続をやり直してください。",
        );
        return Err("OAuth state validation failed.".to_string());
    }
    let Some(code) = query.get("code") else {
        let error = query
            .get("error")
            .cloned()
            .unwrap_or_else(|| "Authorization was cancelled.".to_string());
        write_oauth_response(
            &mut stream,
            "400 Bad Request",
            "Googleアカウントの接続は完了していません。Mintに戻ってもう一度お試しください。",
        );
        return Err(error);
    };
    write_oauth_response(
        &mut stream,
        "200 OK",
        "認証を受け付けました。この画面を閉じてMintに戻ってください。",
    );
    let token = google_client()?
        .post(TOKEN_URL)
        .form(&[
            ("client_id", client_id()?),
            ("code", code.as_str()),
            ("code_verifier", verifier.as_str()),
            ("grant_type", "authorization_code"),
            ("redirect_uri", redirect_uri.as_str()),
        ])
        .send()
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<TokenResponse>()
        .map_err(|error| error.to_string())?;
    let refresh_token = token
        .refresh_token
        .ok_or_else(|| "Google did not return a refresh token.".to_string())?;
    let profile = google_client()?
        .get("https://openidconnect.googleapis.com/v1/userinfo")
        .bearer_auth(&token.access_token)
        .send()
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<UserInfoResponse>()
        .map_err(|error| error.to_string())?;
    token_entry()?
        .set_password(&refresh_token)
        .map_err(|error| error.to_string())?;
    if !profile.email.is_empty() {
        let _ = account_entry().and_then(|entry| {
            entry
                .set_password(&profile.email)
                .map_err(|error| error.to_string())
        });
    }
    let pending_operations = pending_count(app.state::<CalendarStoreState>().inner())?;
    let mut runtime = state
        .status
        .lock()
        .map_err(|_| "Google Calendar state is unavailable.".to_string())?;
    runtime.account_email = profile.email;
    runtime.error = None;
    Ok(GoogleCalendarConnection {
        connected: true,
        account_email: runtime.account_email.clone(),
        last_synced_at: runtime.last_synced_at.clone(),
        pending_operations,
        error: None,
        syncing: false,
    })
}

#[tauri::command]
pub async fn list_google_calendars(app: AppHandle) -> Result<Vec<GoogleCalendarInfo>, String> {
    run_blocking(move || {
        let state = app.state::<GoogleCalendarState>();
        let _operation = state
            .operation
            .lock()
            .map_err(|_| "Google Calendar operation state is unavailable.".to_string())?;
        list_google_calendars_blocking()
    })
    .await
}

pub(super) fn list_google_calendars_blocking() -> Result<Vec<GoogleCalendarInfo>, String> {
    let token = refresh_access_token()?;
    list_google_calendars_with_token(&token)
}

pub(super) fn list_google_calendars_with_token(
    token: &str,
) -> Result<Vec<GoogleCalendarInfo>, String> {
    let client = google_client()?;
    let mut page_token: Option<String> = None;
    let mut result = Vec::new();
    loop {
        let mut request = client
            .get(format!("{API_ROOT}/users/me/calendarList"))
            .bearer_auth(token);
        if let Some(value) = &page_token {
            request = request.query(&[("pageToken", value)]);
        }
        let page = request
            .send()
            .map_err(|error| error.to_string())?
            .error_for_status()
            .map_err(|error| error.to_string())?
            .json::<CalendarListResponse>()
            .map_err(|error| error.to_string())?;
        result.extend(page.items.into_iter().map(|item| GoogleCalendarInfo {
            id: item.id,
            name: item.summary,
            primary: item.primary,
            access_role: item.access_role,
            background_color: item.background_color,
        }));
        page_token = page.next_page_token;
        if page_token.is_none() {
            break;
        }
    }
    Ok(result)
}

#[tauri::command]
pub async fn disconnect_google_calendar(app: AppHandle) -> Result<(), String> {
    run_blocking(move || disconnect_google_calendar_blocking(app)).await
}

fn disconnect_google_calendar_blocking(app: AppHandle) -> Result<(), String> {
    let state = app.state::<GoogleCalendarState>();
    let store = app.state::<CalendarStoreState>();
    let _operation = state
        .operation
        .lock()
        .map_err(|_| "Google Calendar operation state is unavailable.".to_string())?;
    if pending_count(store.inner())? > 0 {
        return Err(
            "未同期の予定が残っているため、接続を解除できません。先に同期してください。"
                .to_string(),
        );
    }
    if let Some(token) = load_refresh_token()? {
        std::thread::spawn(move || {
            if let Ok(client) = google_client() {
                let _ = client
                    .post("https://oauth2.googleapis.com/revoke")
                    .form(&[("token", token)])
                    .send();
            }
        });
    }
    match token_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => {}
        Err(error) => return Err(error.to_string()),
    }
    if let Ok(entry) = account_entry() {
        let _ = entry.delete_credential();
    }
    let connection = open_store(store.path())?;
    connection
        .execute("DELETE FROM calendar_events WHERE source_kind='google'", [])
        .map_err(|error| error.to_string())?;
    connection
        .execute("DELETE FROM google_calendar_sync", [])
        .map_err(|error| error.to_string())?;
    let mut runtime = state
        .status
        .lock()
        .map_err(|_| "Google Calendar state is unavailable.".to_string())?;
    runtime.account_email.clear();
    runtime.last_synced_at = None;
    runtime.error = None;
    runtime.syncing = false;
    Ok(())
}
