use super::{
    EpicManifest, GameScanResult, GameSourceStatus, GameStore, InstalledGame, RiotProductSettings,
};
use base64::Engine;
use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::State;

const MAX_ARTWORK_BYTES: u64 = 512 * 1024;
const MAX_STEAM_FALLBACK_ARTWORK_BYTES: usize = 8 * 1024 * 1024;
const SCAN_CACHE_TTL: Duration = Duration::from_secs(30);

struct CachedGameScan {
    scanned_at: Instant,
    result: GameScanResult,
}

#[derive(Default)]
pub struct GameScanCache(Mutex<Option<CachedGameScan>>);

pub(super) fn program_data() -> PathBuf {
    std::env::var_os("PROGRAMDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(r"C:\ProgramData"))
}

fn scan_steam(include_artwork: bool) -> (Vec<InstalledGame>, GameSourceStatus) {
    let mut games = Vec::new();
    let mut fallback_artwork_bytes: usize = 0;
    let result = (|| -> Result<(), String> {
        let steam = steamlocate::locate().map_err(|error| error.to_string())?;
        for library in steam.libraries().map_err(|error| error.to_string())? {
            let library = library.map_err(|error| error.to_string())?;
            for app in library.apps() {
                let app = app.map_err(|error| error.to_string())?;
                let Some(title) = app.name.filter(|name| !name.trim().is_empty()) else {
                    continue;
                };
                let fallback_image_path = if include_artwork {
                    find_steam_artwork(steam.path(), app.app_id).and_then(|path| {
                        let data_url = image_file_data_url(&path)?;
                        if fallback_artwork_bytes.saturating_add(data_url.len())
                            > MAX_STEAM_FALLBACK_ARTWORK_BYTES
                        {
                            return None;
                        }
                        fallback_artwork_bytes += data_url.len();
                        Some(data_url)
                    })
                } else {
                    None
                };
                games.push(InstalledGame {
                    id: app.app_id.to_string(),
                    title,
                    store: GameStore::Steam,
                    image_path: Some(format!(
                        "https://cdn.cloudflare.steamstatic.com/steam/apps/{}/header.jpg",
                        app.app_id
                    )),
                    fallback_image_path,
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

pub(super) fn find_steam_artwork(steam_path: &Path, app_id: u32) -> Option<PathBuf> {
    let cache = steam_path.join("appcache").join("librarycache");
    let legacy = [
        cache.join(format!("{app_id}_header.jpg")),
        cache.join(app_id.to_string()).join("header.jpg"),
        cache.join(app_id.to_string()).join("library_capsule.jpg"),
        cache.join(app_id.to_string()).join("library_600x900.jpg"),
    ];
    if let Some(path) = legacy.into_iter().find(|path| path.is_file()) {
        return Some(path);
    }
    let app_cache = cache.join(app_id.to_string());
    let mut candidates = fs::read_dir(app_cache)
        .ok()?
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| {
            matches!(
                path.extension().and_then(|extension| extension.to_str()),
                Some("jpg" | "jpeg" | "png" | "webp")
            )
        })
        .collect::<Vec<_>>();
    candidates.sort_by_key(|path| {
        let name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("");
        (
            !name.contains("header") && !name.contains("library_capsule"),
            name.to_string(),
        )
    });
    candidates.into_iter().next()
}

pub(super) fn image_file_data_url(path: &Path) -> Option<String> {
    let mime = match path
        .extension()
        .and_then(|extension| extension.to_str())?
        .to_ascii_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        _ => return None,
    };
    if fs::metadata(path).ok()?.len() > MAX_ARTWORK_BYTES {
        return None;
    }
    let bytes = fs::read(path).ok()?;
    Some(format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    ))
}

fn epic_manifest_dir() -> PathBuf {
    program_data().join("Epic/EpicGamesLauncher/Data/Manifests")
}

fn scan_epic(include_artwork: bool) -> (Vec<InstalledGame>, GameSourceStatus) {
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
                        let executable = include_artwork
                            .then(|| epic_executable(&manifest))
                            .flatten();
                        games.push(InstalledGame {
                            id: epic_id(&manifest),
                            title: manifest.display_name,
                            store: GameStore::Epic,
                            image_path: executable.as_deref().and_then(icon_data_url),
                            fallback_image_path: None,
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

fn epic_executable(manifest: &EpicManifest) -> Option<PathBuf> {
    Some(
        PathBuf::from(manifest.install_location.as_ref()?)
            .join(manifest.launch_executable.as_ref()?),
    )
    .filter(|path| path.is_file())
}

pub(super) fn epic_id(manifest: &EpicManifest) -> String {
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

pub(super) fn riot_products() -> &'static [(&'static str, &'static str)] {
    &[
        ("league_of_legends", "League of Legends"),
        ("valorant", "VALORANT"),
        ("bacon", "Legends of Runeterra"),
    ]
}

fn scan_riot(include_artwork: bool) -> (Vec<InstalledGame>, GameSourceStatus) {
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
    let (games, warning) = scan_riot_directory_with_artwork(&directory, include_artwork);
    (
        games,
        GameSourceStatus {
            store: GameStore::Riot,
            detected: true,
            warning,
        },
    )
}

#[cfg(test)]
pub(super) fn scan_riot_directory(directory: &Path) -> (Vec<InstalledGame>, Option<String>) {
    scan_riot_directory_with_artwork(directory, true)
}

fn scan_riot_directory_with_artwork(
    directory: &Path,
    include_artwork: bool,
) -> (Vec<InstalledGame>, Option<String>) {
    let mut games = Vec::new();
    let mut warning = None;
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) => return (games, Some(error.to_string())),
    };
    for entry in entries.flatten().filter(|entry| entry.path().is_dir()) {
        let folder_name = entry.file_name().to_string_lossy().into_owned();
        let product = riot_product_id(&folder_name);
        let Some((id, title)) = riot_products().iter().find(|(id, _)| *id == product) else {
            continue;
        };
        let settings_path = find_riot_settings_file(&entry.path(), product);
        let settings = settings_path
            .as_deref()
            .and_then(|path| fs::read_to_string(path).ok())
            .and_then(|content| serde_yaml::from_str::<RiotProductSettings>(&content).ok());
        let executable = include_artwork
            .then(|| settings.as_ref().and_then(riot_executable))
            .flatten();
        let image_path = include_artwork
            .then(|| {
                find_riot_icon_file(&entry.path(), &folder_name)
                    .as_deref()
                    .and_then(image_file_data_url)
                    .or_else(|| executable.as_deref().and_then(icon_data_url))
            })
            .flatten();
        if settings_path.is_some() && settings.is_none() {
            warning.get_or_insert_with(|| format!("{folder_name} の設定を読み取れませんでした"));
        }
        games.push(InstalledGame {
            id: (*id).to_string(),
            title: (*title).to_string(),
            store: GameStore::Riot,
            image_path,
            fallback_image_path: None,
        });
    }
    (games, warning)
}

pub(super) fn riot_product_id(metadata_folder: &str) -> &str {
    metadata_folder.split('.').next().unwrap_or(metadata_folder)
}

pub(super) fn is_detected_game(id: &str, store: GameStore) -> bool {
    let games = match store {
        GameStore::Steam => scan_steam(false).0,
        GameStore::Epic => scan_epic(false).0,
        GameStore::Riot => scan_riot(false).0,
    };
    games
        .iter()
        .any(|game| game.id == id && game.store == store)
}

fn find_riot_settings_file(directory: &Path, product: &str) -> Option<PathBuf> {
    let expected = directory.join(format!("{product}.live.product_settings.yaml"));
    if expected.is_file() {
        return Some(expected);
    }
    fs::read_dir(directory)
        .ok()?
        .flatten()
        .map(|entry| entry.path())
        .find(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.ends_with(".product_settings.yaml"))
        })
}

fn find_riot_icon_file(directory: &Path, folder_name: &str) -> Option<PathBuf> {
    let expected = directory.join(format!("{folder_name}.ico"));
    if expected.is_file() {
        return Some(expected);
    }
    fs::read_dir(directory)
        .ok()?
        .flatten()
        .map(|entry| entry.path())
        .find(|path| path.extension().and_then(|extension| extension.to_str()) == Some("ico"))
}

fn riot_executable(settings: &RiotProductSettings) -> Option<PathBuf> {
    let root = PathBuf::from(settings.product_install_full_path.as_ref()?);
    let executable = settings.product_launch.as_ref()?.executable.as_ref()?;
    Some(root.join(executable)).filter(|path| path.is_file())
}

#[cfg(target_os = "windows")]
fn icon_data_url(executable: &Path) -> Option<String> {
    let bytes = systemicons::get_icon(executable.to_str()?, 64).ok()?;
    Some(format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    ))
}

#[cfg(not(target_os = "windows"))]
fn icon_data_url(_executable: &Path) -> Option<String> {
    None
}

#[tauri::command]
pub fn list_installed_games(force: bool, state: State<'_, GameScanCache>) -> GameScanResult {
    let mut cache = state.0.lock().unwrap_or_else(|error| error.into_inner());
    if !force {
        if let Some(cached) = cache.as_ref() {
            if cached.scanned_at.elapsed() < SCAN_CACHE_TTL {
                return cached.result.clone();
            }
        }
    }

    let (mut games, steam) = scan_steam(true);
    let (epic_games, epic) = scan_epic(true);
    let (riot_games, riot) = scan_riot(true);
    games.extend(epic_games);
    games.extend(riot_games);
    let mut seen = HashSet::new();
    games.retain(|game| seen.insert(format!("{:?}:{}", game.store, game.id)));
    games.sort_by_cached_key(|game| (game.title.to_lowercase(), format!("{:?}", game.store)));
    let result = GameScanResult {
        games,
        sources: vec![steam, epic, riot],
    };
    *cache = Some(CachedGameScan {
        scanned_at: Instant::now(),
        result: result.clone(),
    });
    result
}
