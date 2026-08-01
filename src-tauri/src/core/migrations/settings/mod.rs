//! Migration chain for `settings.json`.
//!
//! Version history:
//!
//! - v0: legacy format, a plain `AppSettings` object without a version field.
//!   Files written before this framework are treated as v0.
//! - v1: versioned envelope `{ "schemaVersion": 1, "data": { ... } }` wrapping
//!   the existing `AppSettings` object unchanged.
//! - v2: adds `data.onboarding.completedVersion` so existing users are not
//!   forced through the first-run setup introduced in this version.

use super::{run_migrations, Migration, MigrationOutcome};

/// Latest schema version of `settings.json`.
pub const SETTINGS_SCHEMA_VERSION: u32 = 2;

/// Build the full migration chain for settings data.
pub fn settings_migrations() -> Vec<Migration> {
    vec![
        Migration {
            from_version: 0,
            to_version: 1,
            name: "settings-v0-to-v1-envelope",
            apply: Box::new(wrap_in_versioned_envelope),
        },
        Migration {
            from_version: 1,
            to_version: 2,
            name: "settings-v1-to-v2-onboarding",
            apply: Box::new(mark_onboarding_completed_for_existing_users),
        },
    ]
}

/// Wrap a legacy unversioned settings object into the v1 envelope.
fn wrap_in_versioned_envelope(data: &serde_json::Value) -> Result<serde_json::Value, String> {
    if data.get("schemaVersion").is_some() {
        return Err(
            "既に schemaVersion を持つデータを再度ラップすることはできません。".to_string(),
        );
    }
    Ok(serde_json::json!({
        "schemaVersion": 1,
        "data": data,
    }))
}

/// Mark existing users' onboarding as completed at the current flow version.
///
/// The onboarding field was introduced in this version. Existing settings
/// files predate the setup flow, so their owners must not be forced through
/// first-run setup after an upgrade. A fresh install (no file at all) still
/// receives the `OnboardingSettings::default()` (completedVersion 0) from
/// `load_settings_internal` and sees the flow.
fn mark_onboarding_completed_for_existing_users(
    data: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    let mut data = data.clone();
    let inner = data
        .get_mut("data")
        .and_then(|value| value.as_object_mut())
        .ok_or_else(|| "envelope に data オブジェクトがありません。".to_string())?;
    if inner.get("onboarding").is_none() {
        inner.insert(
            "onboarding".to_string(),
            serde_json::json!({
                "completedVersion": crate::core::settings_model::ONBOARDING_VERSION,
                "completedAt": null,
            }),
        );
    }
    data["schemaVersion"] = serde_json::json!(2);
    Ok(data)
}

/// Create the latest envelope around serialized settings.
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
    fn empty_object_migrates_to_latest_envelope() {
        let outcome = migrate_settings_content("{}").unwrap();
        assert_eq!(outcome.from_version, 0);
        assert_eq!(
            outcome.applied,
            vec!["settings-v0-to-v1-envelope", "settings-v1-to-v2-onboarding"]
        );
        assert_eq!(outcome.data["schemaVersion"], 2);
        assert!(outcome.data["data"].is_object());
        assert_eq!(
            outcome.data["data"]["onboarding"]["completedVersion"],
            crate::core::settings_model::ONBOARDING_VERSION
        );
    }

    #[test]
    fn legacy_settings_fixture_migrates_preserving_values() {
        let content = fixture("legacy-settings-v0.json");
        let outcome = migrate_settings_content(&content).unwrap();

        assert_eq!(outcome.from_version, 0);
        assert_eq!(outcome.data["schemaVersion"], 2);
        let data = outcome.data["data"].clone();
        assert_eq!(data["theme"], "dark");
        assert_eq!(data["autostart"], false);
        assert_eq!(data["fileShelf"]["enabled"], true);
        assert_eq!(data["fileShelf"]["edge"], "right");
        assert_eq!(data["fileShelf"]["clipboardHistoryLimit"], 25);
        assert_eq!(data["clock"]["themeColor"], "#5B8CFF");
        assert_eq!(data["calendar"]["createEventShortcut"], "Ctrl+Alt+E");
        assert_eq!(data["voiceToText"]["model"], "whisper-1");
        assert_eq!(data["onboarding"]["completedVersion"], 1);
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
    fn already_versioned_latest_content_is_not_reapplied() {
        let content = r#"{"schemaVersion":2,"data":{"theme":"dark"}}"#;
        let outcome = migrate_settings_content(content).unwrap();

        assert_eq!(outcome.from_version, 2);
        assert!(outcome.applied.is_empty());
        assert_eq!(outcome.data["schemaVersion"], 2);
        assert_eq!(outcome.data["data"]["theme"], "dark");
    }

    #[test]
    fn v1_envelope_migrates_to_v2_without_reapplying_envelope() {
        let content = r#"{"schemaVersion":1,"data":{"theme":"dark"}}"#;
        let outcome = migrate_settings_content(content).unwrap();

        assert_eq!(outcome.from_version, 1);
        assert_eq!(outcome.applied, vec!["settings-v1-to-v2-onboarding"]);
        assert_eq!(outcome.data["schemaVersion"], 2);
        assert_eq!(outcome.data["data"]["theme"], "dark");
        assert_eq!(outcome.data["data"]["onboarding"]["completedVersion"], 1);
    }

    #[test]
    fn v1_envelope_with_existing_onboarding_keeps_it() {
        let content =
            r#"{"schemaVersion":1,"data":{"theme":"light","onboarding":{"completedVersion":3}}}"#;
        let outcome = migrate_settings_content(content).unwrap();

        assert_eq!(outcome.from_version, 1);
        assert_eq!(outcome.data["schemaVersion"], 2);
        assert_eq!(outcome.data["data"]["onboarding"]["completedVersion"], 3);
    }

    #[test]
    fn future_version_fixture_is_rejected() {
        let content = fixture("future-version.json");
        let error = migrate_settings_content(&content).unwrap_err();
        assert!(matches!(
            error,
            crate::core::migrations::MigrationError::FutureVersion {
                found: 99,
                latest: 2
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
        assert_eq!(outcome.data["schemaVersion"], 2);
        let data = outcome.data["data"].clone();
        assert_eq!(data["theme"], "dark");
        assert_eq!(data["autostart"], "not-a-boolean");
    }

    #[test]
    fn envelope_round_trip_extracts_data() {
        let settings = serde_json::json!({ "theme": "dark" });
        let envelope = wrap_settings(&settings);
        assert_eq!(envelope["schemaVersion"], 2);
        let data = extract_envelope_data(&envelope).unwrap();
        assert_eq!(data["theme"], "dark");
    }
}
