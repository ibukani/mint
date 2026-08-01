use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

use super::model::PersistedWindowState;
use super::WINDOW_STATE_VERSION;
use crate::core::settings_store::write_settings_atomically;

pub(crate) fn window_state_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?
        .join("window_state");
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    }
    Ok(dir)
}

fn state_path(dir: &Path, label: &str) -> PathBuf {
    dir.join(format!("{label}.json"))
}

pub fn load(dir: &Path, label: &str) -> Option<PersistedWindowState> {
    let content = fs::read_to_string(state_path(dir, label)).ok()?;
    let state: PersistedWindowState = serde_json::from_str(&content).ok()?;
    if state.version != WINDOW_STATE_VERSION {
        return None;
    }
    Some(state)
}

pub fn save(dir: &Path, label: &str, state: &PersistedWindowState) -> Result<(), String> {
    let json = serde_json::to_string_pretty(state).map_err(|error| error.to_string())?;
    write_settings_atomically(&state_path(dir, label), &json)
}

pub fn delete(dir: &Path, label: &str) -> Result<(), String> {
    let path = state_path(dir, label);
    if path.exists() {
        fs::remove_file(&path).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    static TEMP_COUNTER: AtomicU32 = AtomicU32::new(0);

    fn temp_dir(name: &str) -> PathBuf {
        let counter = TEMP_COUNTER.fetch_add(1, Ordering::SeqCst);
        let dir = std::env::temp_dir().join(format!(
            "mint-window-state-{name}-{counter}-{}",
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn sample_state() -> PersistedWindowState {
        PersistedWindowState {
            version: WINDOW_STATE_VERSION,
            x: 120,
            y: 80,
            width: 900,
            height: 650,
            monitor_id: None,
            maximized: false,
        }
    }

    #[test]
    fn save_and_load_round_trip() {
        let dir = temp_dir("roundtrip");
        let state = sample_state();
        save(&dir, "main", &state).unwrap();
        let loaded = load(&dir, "main").unwrap();
        assert_eq!(loaded, state);
    }

    #[test]
    fn load_returns_none_for_missing_file() {
        let dir = temp_dir("missing");
        assert!(load(&dir, "main").is_none());
    }

    #[test]
    fn load_returns_none_for_corrupt_file() {
        let dir = temp_dir("corrupt");
        fs::write(state_path(&dir, "main"), "{not valid json").unwrap();
        assert!(load(&dir, "main").is_none());
    }

    #[test]
    fn load_returns_none_for_unknown_version() {
        let dir = temp_dir("version");
        fs::write(
            state_path(&dir, "main"),
            r#"{"version":99,"x":0,"y":0,"width":10,"height":10,"maximized":false}"#,
        )
        .unwrap();
        assert!(load(&dir, "main").is_none());
    }

    #[test]
    fn delete_removes_state_file() {
        let dir = temp_dir("delete");
        save(&dir, "main", &sample_state()).unwrap();
        assert!(load(&dir, "main").is_some());
        delete(&dir, "main").unwrap();
        assert!(load(&dir, "main").is_none());
        delete(&dir, "main").unwrap();
    }

    #[test]
    fn different_labels_do_not_collide() {
        let dir = temp_dir("labels");
        let state = sample_state();
        save(&dir, "main", &state).unwrap();
        assert!(load(&dir, "quickCapture").is_none());
    }
}
