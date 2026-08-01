//! Pre-migration backup creation and retention.
//!
//! Backups are written next to the migrated data file under a `backups`
//! subdirectory, named with the data kind, the old version, and a timestamp:
//!
//! ```text
//! <data_dir>/backups/<kind>.v<version>.backup-<YYYYMMDD-HHMMSS>.json
//! ```

use std::fs;
use std::path::{Path, PathBuf};

/// Maximum number of backups kept per data kind before the oldest are pruned.
pub const DEFAULT_MAX_BACKUPS: usize = 5;

fn backup_dir_for(path: &Path) -> PathBuf {
    path.parent()
        .unwrap_or_else(|| Path::new("."))
        .join("backups")
}

/// Build the backup file name for a kind, version, and timestamp.
pub fn backup_file_name(kind: &str, from_version: u32, timestamp: &str) -> String {
    format!("{kind}.v{from_version}.backup-{timestamp}.json")
}

/// Copy the current data file to a timestamped backup before a migration.
pub fn create_backup(path: &Path, kind: &str, from_version: u32) -> Result<PathBuf, String> {
    let source = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let backup_dir = backup_dir_for(path);
    fs::create_dir_all(&backup_dir).map_err(|error| error.to_string())?;

    let timestamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
    let backup_path = backup_dir.join(backup_file_name(kind, from_version, &timestamp.to_string()));
    fs::write(&backup_path, source).map_err(|error| error.to_string())?;

    prune_backups(&backup_dir, kind, DEFAULT_MAX_BACKUPS);
    Ok(backup_path)
}

/// Keep only the newest `max_backups` backups for the given kind.
///
/// Backup names embed a sortable timestamp (`...-YYYYMMDD-HHMMSS.json`), so
/// lexical ordering matches chronological order.
pub fn prune_backups(backup_dir: &Path, kind: &str, max_backups: usize) {
    let prefix = format!("{kind}.v");
    let Ok(entries) = fs::read_dir(backup_dir) else {
        return;
    };

    let mut backups: Vec<PathBuf> = entries
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|entry| {
            entry
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with(&prefix) && name.ends_with(".json"))
        })
        .collect();

    if backups.len() <= max_backups {
        return;
    }

    backups.sort();
    let keep = backups.len() - max_backups;
    for old_backup in backups.into_iter().take(keep) {
        let _ = fs::remove_file(old_backup);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("mint-migration-{name}-{}", uuid::Uuid::new_v4()))
    }

    #[test]
    fn backup_file_name_embeds_kind_version_and_timestamp() {
        let name = backup_file_name("settings", 0, "20260101-120000");
        assert_eq!(name, "settings.v0.backup-20260101-120000.json");
    }

    #[test]
    fn create_backup_writes_file() {
        let dir = temp_dir("backup");
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("settings.json");
        fs::write(&path, "{\"old\":true}").unwrap();

        let backup = create_backup(&path, "settings", 0).unwrap();
        assert!(backup.exists());
        assert_eq!(fs::read_to_string(&backup).unwrap(), "{\"old\":true}");
        assert_eq!(backup.parent().unwrap(), dir.join("backups").as_path());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn create_backup_fails_when_source_is_missing() {
        let dir = temp_dir("missing");
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("settings.json");

        let error = create_backup(&path, "settings", 0).unwrap_err();
        assert!(!error.is_empty());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn prune_keeps_newest_backups_lexicographically() {
        let dir = temp_dir("prune");
        fs::create_dir_all(&dir).unwrap();
        for index in 0..4 {
            let name = backup_file_name("settings", 0, &format!("2026010{index}-120000"));
            fs::write(dir.join(name), "content").unwrap();
        }

        prune_backups(&dir, "settings", 2);

        let remaining: Vec<String> = fs::read_dir(&dir)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(remaining.len(), 2);
        assert!(remaining.contains(&backup_file_name("settings", 0, "20260102-120000")));
        assert!(remaining.contains(&backup_file_name("settings", 0, "20260103-120000")));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn prune_ignores_other_kinds_and_non_backup_files() {
        let dir = temp_dir("prune-other");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("settings.v0.backup-20260101-120000.json"), "a").unwrap();
        fs::write(dir.join("window_state.v0.backup-20260101-120000.json"), "b").unwrap();
        fs::write(dir.join("settings.json"), "c").unwrap();

        prune_backups(&dir, "settings", 0);

        assert!(dir
            .join("window_state.v0.backup-20260101-120000.json")
            .exists());
        assert!(dir.join("settings.json").exists());
        assert!(!dir.join("settings.v0.backup-20260101-120000.json").exists());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn timestamp_is_sorted_descending_so_newest_survives() {
        let earlier = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let later = earlier + 10;
        assert!(
            backup_file_name("settings", 0, &later.to_string())
                > backup_file_name("settings", 0, &earlier.to_string())
        );
    }
}
