//! Migration chain for `settings.json`.
//!
//! Version history:
//!
//! - v0: legacy format, a plain `AppSettings` object without a version field.
//!   Files written before this framework are treated as v0.
//! - v1: versioned envelope `{ "schemaVersion": 1, "data": { ... } }` wrapping
//!   the existing `AppSettings` object unchanged.

use super::{run_migrations, Migration, MigrationOutcome};

/// Latest schema version of `settings.json`.
pub const SETTINGS_SCHEMA_VERSION: u32 = 1;

/// Build the full migration chain for settings data.
pub fn settings_migrations() -> Vec<Migration> {
    vec![Migration {
        from_version: 0,
        to_version: 1,
        name: "settings-v0-to-v1-envelope",
        apply: Box::new(wrap_in_versioned_envelope),
    }]
}

/// Wrap a legacy unversioned settings object into the v1 envelope.
fn wrap_in_versioned_envelope(data: &serde_json::Value) -> Result<serde_json::Value, String> {
    if data.get("schemaVersion").is_some() {
        return Err(
            "既に schemaVersion を持つデータを再度ラップすることはできません。".to_string(),
        );
    }
    Ok(serde_json::json!({
        "schemaVersion": SETTINGS_SCHEMA_VERSION,
        "data": data,
    }))
}

/// Create the v1 envelope around serialized settings.
pub fn wrap_settings(settings: &serde_json::Value) -> serde_json::Value {
    serde_json::json!({
        "schemaVersion": SETTINGS_SCHEMA_VERSION,
        "data": settings,
    })
}

/// Extract the `data` payload from a versioned envelope.
pub fn extract_envelope_data(envelope: &serde_json::Value) -> Result<&serde_json::Value, String> {
    envelope
        .get("data")
        .ok_or_else(|| "設定データの envelope に data フィールドがありません。".to_string())
}

/// Migrate settings content to the latest version, reporting what changed.
pub fn migrate_settings_content(
    content: &str,
) -> Result<MigrationOutcome, crate::core::migrations::MigrationError> {
    run_migrations(content, &settings_migrations(), SETTINGS_SCHEMA_VERSION)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture(name: &str) -> String {
        let path = format!(
            "{}/src/core/migrations/settings/fixtures/{name}",
            env!("CARGO_MANIFEST_DIR")
        );
        std::fs::read_to_string(path).expect("fixture file must exist")
    }

    #[test]
    fn empty_object_migrates_to_version_one_envelope() {
        let outcome = migrate_settings_content("{}").unwrap();
        assert_eq!(outcome.from_version, 0);
        assert_eq!(outcome.applied, vec!["settings-v0-to-v1-envelope"]);
        assert_eq!(outcome.data["schemaVersion"], 1);
        assert!(outcome.data["data"].is_object());
        assert!(outcome.data["data"].as_object().unwrap().is_empty());
    }

    #[test]
    fn legacy_settings_fixture_migrates_preserving_values() {
        let content = fixture("legacy-settings-v0.json");
        let outcome = migrate_settings_content(&content).unwrap();

        assert_eq!(outcome.from_version, 0);
        assert_eq!(outcome.data["schemaVersion"], 1);
        let data = outcome.data["data"].clone();
        assert_eq!(data["theme"], "dark");
        assert_eq!(data["autostart"], false);
        assert_eq!(data["fileShelf"]["enabled"], true);
        assert_eq!(data["fileShelf"]["edge"], "right");
        assert_eq!(data["fileShelf"]["clipboardHistoryLimit"], 25);
        assert_eq!(data["clock"]["themeColor"], "#5B8CFF");
        assert_eq!(data["calendar"]["createEventShortcut"], "Ctrl+Alt+E");
        assert_eq!(data["voiceToText"]["model"], "whisper-1");
    }

    #[test]
    fn partially_missing_fields_survive_migration() {
        let content = fixture("partial-fields.json");
        let outcome = migrate_settings_content(&content).unwrap();

        assert_eq!(outcome.from_version, 0);
        let data = outcome.data["data"].clone();
        assert_eq!(data["theme"], "light");
        assert_eq!(data["clock"]["enabled"], true);
        assert!(data.get("autostart").is_none());
        assert!(data.get("fileShelf").is_none());
    }

    #[test]
    fn already_versioned_content_is_not_reapplied() {
        let content = r#"{"schemaVersion":1,"data":{"theme":"dark"}}"#;
        let outcome = migrate_settings_content(content).unwrap();

        assert_eq!(outcome.from_version, 1);
        assert!(outcome.applied.is_empty());
        assert_eq!(outcome.data["schemaVersion"], 1);
        assert_eq!(outcome.data["data"]["theme"], "dark");
    }

    #[test]
    fn future_version_fixture_is_rejected() {
        let content = fixture("future-version.json");
        let error = migrate_settings_content(&content).unwrap_err();
        assert!(matches!(
            error,
            crate::core::migrations::MigrationError::FutureVersion {
                found: 99,
                latest: 1
            }
        ));
    }

    #[test]
    fn corrupt_fixture_is_rejected() {
        let content = fixture("corrupt-settings.txt");
        let error = migrate_settings_content(&content).unwrap_err();
        assert!(matches!(
            error,
            crate::core::migrations::MigrationError::InvalidJson(_)
        ));
    }

    #[test]
    fn invalid_types_fixture_migrates_structurally_but_validation_can_catch_later() {
        let content = fixture("invalid-types.json");
        let outcome = migrate_settings_content(&content).unwrap();

        assert_eq!(outcome.from_version, 0);
        assert_eq!(outcome.data["schemaVersion"], 1);
        let data = outcome.data["data"].clone();
        assert_eq!(data["theme"], "dark");
        assert_eq!(data["autostart"], "not-a-boolean");
    }

    #[test]
    fn envelope_round_trip_extracts_data() {
        let settings = serde_json::json!({ "theme": "dark" });
        let envelope = wrap_settings(&settings);
        assert_eq!(envelope["schemaVersion"], 1);
        let data = extract_envelope_data(&envelope).unwrap();
        assert_eq!(data["theme"], "dark");
    }
}
