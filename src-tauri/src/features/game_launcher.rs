use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition};

const WINDOW_LABEL: &str = "gameLauncher";

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InstalledGame {
    pub id: String,
    pub title: String,
    pub store: GameStore,
    pub image_path: Option<String>,
}

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum GameStore {
    Steam,
    Epic,
    Riot,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GameSourceStatus {
    pub store: GameStore,
    pub detected: bool,
    pub warning: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameScanResult {
    pub games: Vec<InstalledGame>,
    pub sources: Vec<GameSourceStatus>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchGameRequest {
    pub id: String,
    pub store: GameStoreInput,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GameStoreInput {
    Steam,
    Epic,
    Riot,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct EpicManifest {
    display_name: String,
    app_name: String,
    catalog_namespace: Option<String>,
    catalog_item_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RiotInstalls {
    rc_default: Option<String>,
}

fn program_data() -> PathBuf {
    std::env::var_os("PROGRAMDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(r"C:\ProgramData"))
}

fn scan_steam() -> (Vec<InstalledGame>, GameSourceStatus) {
    let mut games = Vec::new();
    let result = (|| -> Result<(), String> {
        let steam = steamlocate::locate().map_err(|error| error.to_string())?;
        for library in steam.libraries().map_err(|error| error.to_string())? {
            let library = library.map_err(|error| error.to_string())?;
            for app in library.apps() {
                let app = app.map_err(|error| error.to_string())?;
                let Some(title) = app.name.filter(|name| !name.trim().is_empty()) else {
                    continue;
                };
                let image = steam
                    .path()
                    .join("appcache")
                    .join("librarycache")
                    .join(app.app_id.to_string())
                    .join("header.jpg");
                games.push(InstalledGame {
                    id: app.app_id.to_string(),
                    title,
                    store: GameStore::Steam,
                    image_path: image.exists().then(|| image.to_string_lossy().into_owned()),
                });
            }
        }
        Ok(())
    })();
    let detected = result.is_ok();
    (
        games,
        GameSourceStatus {
            store: GameStore::Steam,
            detected,
            warning: result.err(),
        },
    )
}

fn epic_manifest_dir() -> PathBuf {
    program_data().join("Epic/EpicGamesLauncher/Data/Manifests")
}

fn scan_epic() -> (Vec<InstalledGame>, GameSourceStatus) {
    let directory = epic_manifest_dir();
    if !directory.exists() {
        return (
            Vec::new(),
            GameSourceStatus {
                store: GameStore::Epic,
                detected: false,
                warning: None,
            },
        );
    }
    let mut games = Vec::new();
    let mut warning = None;
    match fs::read_dir(&directory) {
        Ok(entries) => {
            for entry in entries.flatten() {
                if entry.path().extension().and_then(|value| value.to_str()) != Some("item") {
                    continue;
                }
                let parsed = fs::read_to_string(entry.path())
                    .map_err(|error| error.to_string())
                    .and_then(|content| {
                        serde_json::from_str::<EpicManifest>(&content)
                            .map_err(|error| error.to_string())
                    });
                match parsed {
                    Ok(manifest) if !manifest.display_name.trim().is_empty() => {
                        games.push(InstalledGame {
                            id: epic_id(&manifest),
                            title: manifest.display_name,
                            store: GameStore::Epic,
                            image_path: None,
                        })
                    }
                    Ok(_) => {}
                    Err(error) => {
                        warning.get_or_insert(error);
                    }
                }
            }
        }
        Err(error) => warning = Some(error.to_string()),
    }
    (
        games,
        GameSourceStatus {
            store: GameStore::Epic,
            detected: true,
            warning,
        },
    )
}

fn epic_id(manifest: &EpicManifest) -> String {
    match (&manifest.catalog_namespace, &manifest.catalog_item_id) {
        (Some(namespace), Some(catalog_id)) => {
            format!("{namespace}:{catalog_id}:{}", manifest.app_name)
        }
        _ => manifest.app_name.clone(),
    }
}

fn riot_metadata_dir() -> PathBuf {
    program_data().join("Riot Games/Metadata")
}

fn riot_products() -> &'static [(&'static str, &'static str)] {
    &[
        ("league_of_legends", "League of Legends"),
        ("valorant", "VALORANT"),
        ("legends_of_runeterra", "Legends of Runeterra"),
    ]
}

fn scan_riot() -> (Vec<InstalledGame>, GameSourceStatus) {
    let directory = riot_metadata_dir();
    if !directory.exists() {
        return (
            Vec::new(),
            GameSourceStatus {
                store: GameStore::Riot,
                detected: false,
                warning: None,
            },
        );
    }
    let games = riot_products()
        .iter()
        .filter(|(id, _)| directory.join(id).exists())
        .map(|(id, title)| InstalledGame {
            id: (*id).to_string(),
            title: (*title).to_string(),
            store: GameStore::Riot,
            image_path: None,
        })
        .collect();
    (
        games,
        GameSourceStatus {
            store: GameStore::Riot,
            detected: true,
            warning: None,
        },
    )
}

#[tauri::command]
pub fn list_installed_games() -> GameScanResult {
    let (mut games, steam) = scan_steam();
    let (epic_games, epic) = scan_epic();
    let (riot_games, riot) = scan_riot();
    games.extend(epic_games);
    games.extend(riot_games);
    let mut seen = HashSet::new();
    games.retain(|game| seen.insert(format!("{:?}:{}", game.store, game.id)));
    games.sort_by(|left, right| {
        left.title
            .to_lowercase()
            .cmp(&right.title.to_lowercase())
            .then_with(|| format!("{:?}", left.store).cmp(&format!("{:?}", right.store)))
    });
    GameScanResult {
        games,
        sources: vec![steam, epic, riot],
    }
}

#[tauri::command]
pub fn launch_game(request: LaunchGameRequest) -> Result<(), String> {
    let scan = list_installed_games();
    let store = match request.store {
        GameStoreInput::Steam => GameStore::Steam,
        GameStoreInput::Epic => GameStore::Epic,
        GameStoreInput::Riot => GameStore::Riot,
    };
    if !scan
        .games
        .iter()
        .any(|game| game.store == store && game.id == request.id)
    {
        return Err("検出済みゲームではありません。再スキャンしてください。".to_string());
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

pub fn toggle_game_launcher_overlay(app: &AppHandle) {
    let enabled = crate::core::settings::load_settings_internal(app)
        .map(|settings| settings.game_launcher.enabled)
        .unwrap_or(false);
    if !enabled {
        return;
    }
    let Some(window) = app.get_webview_window(WINDOW_LABEL) else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.emit("game-launcher-hide-requested", ());
        return;
    }
    if let Ok(Some(monitor)) = window.current_monitor().or_else(|_| app.primary_monitor()) {
        let size = window
            .outer_size()
            .unwrap_or(tauri::PhysicalSize::new(760, 520));
        let monitor_size = monitor.size();
        let x = monitor.position().x + (monitor_size.width.saturating_sub(size.width) / 2) as i32;
        let y = monitor.position().y + (monitor_size.height.saturating_sub(size.height) / 2) as i32;
        let _ = window.set_position(tauri::Position::Physical(PhysicalPosition::new(x, y)));
    }
    let _ = window.show();
    let _ = window.set_always_on_top(true);
    let _ = window.set_focus();
    let _ = window.emit("game-launcher-shown", ());
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn epic_identifier_keeps_launcher_coordinates() {
        let manifest = EpicManifest {
            display_name: "Test".to_string(),
            app_name: "app".to_string(),
            catalog_namespace: Some("namespace".to_string()),
            catalog_item_id: Some("catalog".to_string()),
        };
        assert_eq!(epic_id(&manifest), "namespace:catalog:app");
    }

    #[test]
    fn riot_products_are_unique() {
        let unique: HashSet<_> = riot_products().iter().map(|(id, _)| *id).collect();
        assert_eq!(unique.len(), riot_products().len());
    }
}
