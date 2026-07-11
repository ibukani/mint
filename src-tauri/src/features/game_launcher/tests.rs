use super::*;
use std::{
    collections::HashSet,
    fs,
    time::{Duration, Instant},
};

#[test]
fn epic_identifier_keeps_launcher_coordinates() {
    let manifest = EpicManifest {
        display_name: "Test".to_string(),
        app_name: "app".to_string(),
        catalog_namespace: Some("namespace".to_string()),
        catalog_item_id: Some("catalog".to_string()),
        install_location: None,
        launch_executable: None,
    };
    assert_eq!(epic_id(&manifest), "namespace:catalog:app");
}

#[test]
fn riot_products_are_unique() {
    let unique: HashSet<_> = riot_products().iter().map(|(id, _)| *id).collect();
    assert_eq!(unique.len(), riot_products().len());
}

#[test]
fn riot_patchline_folder_resolves_to_supported_product() {
    assert_eq!(riot_product_id("valorant.live"), "valorant");
    assert_eq!(
        riot_product_id("league_of_legends.live"),
        "league_of_legends"
    );
    assert_eq!(riot_product_id("bacon.live"), "bacon");
}

#[test]
fn riot_scan_detects_patchline_metadata_directory() {
    let root = std::env::temp_dir().join(format!("mint-riot-{}", uuid::Uuid::new_v4()));
    let metadata = root.join("valorant.live");
    fs::create_dir_all(&metadata).unwrap();
    fs::write(
        metadata.join("valorant.live.product_settings.yaml"),
        "product_install_full_path: 'C:/Riot Games/VALORANT'\nproduct_launch:\n  executable: 'live/VALORANT.exe'\n",
    )
    .unwrap();
    fs::write(metadata.join("valorant.live.ico"), b"icon").unwrap();
    let (games, warning) = scan_riot_directory(&root);
    assert_eq!(warning, None);
    assert_eq!(games.len(), 1);
    assert_eq!(games[0].id, "valorant");
    assert_eq!(games[0].title, "VALORANT");
    assert_eq!(
        games[0].image_path.as_deref(),
        Some("data:image/x-icon;base64,aWNvbg==")
    );
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn steam_artwork_supports_hashed_cache_layout() {
    let root = std::env::temp_dir().join(format!("mint-steam-art-{}", uuid::Uuid::new_v4()));
    let cache = root.join("appcache/librarycache/730");
    fs::create_dir_all(&cache).unwrap();
    let artwork = cache.join("a1b2c3.jpg");
    fs::write(&artwork, b"image").unwrap();
    assert_eq!(find_steam_artwork(&root, 730), Some(artwork.clone()));
    assert_eq!(
        image_file_data_url(&artwork).as_deref(),
        Some("data:image/jpeg;base64,aW1hZ2U=")
    );
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn repeated_shortcut_events_are_debounced() {
    let first = Instant::now();
    assert!(toggle_allowed(None, first));
    assert!(!toggle_allowed(
        Some(first),
        first + Duration::from_millis(249)
    ));
    assert!(toggle_allowed(
        Some(first),
        first + Duration::from_millis(250)
    ));
}

#[test]
fn repeated_launch_requests_are_debounced() {
    let first = Instant::now();
    assert!(interval_elapsed(None, first, LAUNCH_DEBOUNCE));
    assert!(!interval_elapsed(
        Some(first),
        first + Duration::from_millis(1_499),
        LAUNCH_DEBOUNCE
    ));
    assert!(interval_elapsed(
        Some(first),
        first + Duration::from_millis(1_500),
        LAUNCH_DEBOUNCE
    ));
}
