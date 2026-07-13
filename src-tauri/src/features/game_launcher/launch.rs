use super::{
    debounce::interval_elapsed,
    scan::{list_installed_games, program_data, riot_products},
    GameStore, GameStoreInput, LaunchGameRequest, RiotInstalls,
};
use std::{
    fs,
    path::PathBuf,
    process::Command,
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};

pub(super) const LAUNCH_DEBOUNCE: Duration = Duration::from_millis(1_500);
static LAST_LAUNCH: OnceLock<Mutex<Option<Instant>>> = OnceLock::new();

#[tauri::command]
pub fn launch_game(request: LaunchGameRequest) -> Result<(), String> {
    let store = input_store(request.store);
    validate_detected_game(&request.id, store)?;
    if !accept_launch(Instant::now()) {
        return Ok(());
    }
    match store {
        GameStore::Steam => open_uri(&format!("steam://rungameid/{}", request.id)),
        GameStore::Epic => {
            let encoded = request.id.replace(':', "%3A");
            open_uri(&format!(
                "com.epicgames.launcher://apps/{encoded}?action=launch&silent=true"
            ))
        }
        GameStore::Riot => launch_riot(&request.id),
    }
}

#[tauri::command]
pub fn open_game_store_page(request: LaunchGameRequest) -> Result<(), String> {
    let store = input_store(request.store);
    validate_detected_game(&request.id, store)?;
    match store {
        GameStore::Steam => open_uri(&format!("steam://nav/games/details/{}", request.id)),
        GameStore::Epic => open_uri("com.epicgames.launcher://library/"),
        GameStore::Riot => open_riot_client(),
    }
}

fn input_store(store: GameStoreInput) -> GameStore {
    match store {
        GameStoreInput::Steam => GameStore::Steam,
        GameStoreInput::Epic => GameStore::Epic,
        GameStoreInput::Riot => GameStore::Riot,
    }
}

fn validate_detected_game(id: &str, store: GameStore) -> Result<(), String> {
    let scan = list_installed_games();
    if !scan
        .games
        .iter()
        .any(|game| game.store == store && game.id == id)
    {
        return Err("検出済みゲームではありません。再スキャンしてください。".to_string());
    }
    Ok(())
}

fn accept_launch(now: Instant) -> bool {
    let mut last = LAST_LAUNCH
        .get_or_init(|| Mutex::new(None))
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if !interval_elapsed(*last, now, LAUNCH_DEBOUNCE) {
        return false;
    }
    *last = Some(now);
    true
}

#[cfg(target_os = "windows")]
fn open_uri(uri: &str) -> Result<(), String> {
    Command::new("explorer.exe")
        .arg(uri)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("ゲームクライアントを起動できませんでした: {error}"))
}

#[cfg(not(target_os = "windows"))]
fn open_uri(_uri: &str) -> Result<(), String> {
    Err("ゲーム起動は現在Windows 11のみ対応しています。".to_string())
}

fn riot_client_path() -> PathBuf {
    let installs_path = program_data().join("Riot Games/RiotClientInstalls.json");
    fs::read_to_string(installs_path)
        .ok()
        .and_then(|content| serde_json::from_str::<RiotInstalls>(&content).ok())
        .and_then(|installs| installs.rc_default)
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(r"C:\Riot Games\Riot Client\RiotClientServices.exe"))
}

fn launch_riot(product: &str) -> Result<(), String> {
    if !riot_products().iter().any(|(id, _)| *id == product) {
        return Err("未対応のRiot製品です。".to_string());
    }
    let client = riot_client_path();
    if !client.exists() {
        return Err("Riot Clientが見つかりません。".to_string());
    }
    Command::new(client)
        .args([
            format!("--launch-product={product}"),
            "--launch-patchline=live".to_string(),
        ])
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Riot Clientを起動できませんでした: {error}"))
}

fn open_riot_client() -> Result<(), String> {
    let client = riot_client_path();
    if !client.exists() {
        return Err("Riot Clientが見つかりません。".to_string());
    }
    Command::new(client)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Riot Clientを起動できませんでした: {error}"))
}
