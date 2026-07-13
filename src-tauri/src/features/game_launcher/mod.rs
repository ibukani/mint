use serde::{Deserialize, Serialize};

pub mod debounce;
pub mod launch;
pub mod scan;
pub mod window;

pub use window::toggle_game_launcher_overlay;

#[cfg(test)]
mod tests;

#[cfg(test)]
use debounce::interval_elapsed;
#[cfg(test)]
use launch::LAUNCH_DEBOUNCE;
#[cfg(test)]
use scan::{
    epic_id, find_steam_artwork, image_file_data_url, riot_product_id, riot_products,
    scan_riot_directory,
};
#[cfg(test)]
use window::toggle_allowed;

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InstalledGame {
    pub id: String,
    pub title: String,
    pub store: GameStore,
    pub image_path: Option<String>,
    pub fallback_image_path: Option<String>,
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
    install_location: Option<String>,
    launch_executable: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RiotInstalls {
    rc_default: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RiotProductSettings {
    product_install_full_path: Option<String>,
    product_launch: Option<RiotProductLaunch>,
}

#[derive(Debug, Deserialize)]
struct RiotProductLaunch {
    executable: Option<String>,
}
