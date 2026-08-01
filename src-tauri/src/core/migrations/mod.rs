//! Schema versioning and stepwise migration for persisted data.
//!
//! Every persisted data file is expected to use a versioned envelope:
//!
//! ```json
//! {
//!   "schemaVersion": 1,
//!   "data": { "...": "..." }
//! }
//! ```
//!
//! Files written before this framework are treated as version 0. Adjacent
//! versions are converted one step at a time (`v0 -> v1 -> v2 -> ...`), so any
//! intermediate version can be brought up to the latest schema deterministically.

use std::fmt;

pub mod backup;
pub mod settings;

/// Transformation applied by a migration step. Must stay free of I/O.
pub type MigrationApply =
    Box<dyn Fn(&serde_json::Value) -> Result<serde_json::Value, String> + Send + Sync>;

/// A single migration step converting one adjacent version to the next.
pub struct Migration {
    pub from_version: u32,
    pub to_version: u32,
    pub name: &'static str,
    pub apply: MigrationApply,
}

/// Structured errors surfaced when a migration cannot complete safely.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MigrationError {
    InvalidJson(String),
    FutureVersion {
        found: u32,
        latest: u32,
    },
    ChainGap {
        from_version: u32,
    },
    MigrationFailed {
        from_version: u32,
        to_version: u32,
        message: String,
    },
    ValidationFailed(String),
}

impl fmt::Display for MigrationError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            MigrationError::InvalidJson(message) => {
                write!(formatter, "データファイルが破損しています: {message}")
            }
            MigrationError::FutureVersion { found, latest } => write!(
                formatter,
                "データファイルが新しいバージョン(v{found})で作成されています。Mintを最新版へ更新してください(対応: v{latest})。ファイルは変更されていません。"
            ),
            MigrationError::ChainGap { from_version } => write!(
                formatter,
                "v{from_version} から次のバージョンへの移行手順が登録されていません。"
            ),
            MigrationError::MigrationFailed {
                from_version,
                to_version,
                message,
            } => write!(
                formatter,
                "v{from_version} から v{to_version} への移行に失敗しました: {message}"
            ),
            MigrationError::ValidationFailed(message) => {
                write!(formatter, "データの検証に失敗しました: {message}")
            }
        }
    }
}

/// Result of a completed migration run.
#[derive(Debug, Clone, PartialEq)]
pub struct MigrationOutcome {
    /// Schema version detected before migration started.
    pub from_version: u32,
    /// Migrated data in the latest envelope format.
    pub data: serde_json::Value,
    /// Names of the migrations that were applied, in order.
    pub applied: Vec<&'static str>,
}

/// Read the schema version from serialized content.
///
/// A missing `schemaVersion` field is treated as version 0 (the legacy
/// unversioned format). Unparseable JSON is reported as corruption.
pub fn detect_version(content: &str) -> Result<u32, MigrationError> {
    let value: serde_json::Value = serde_json::from_str(content)
        .map_err(|error| MigrationError::InvalidJson(error.to_string()))?;
    match value.get("schemaVersion") {
        None => Ok(0),
        Some(serde_json::Value::Number(number)) => number
            .as_u64()
            .and_then(|value| u32::try_from(value).ok())
            .ok_or_else(|| {
                MigrationError::ValidationFailed(
                    "schemaVersion は0以上の数値である必要があります".to_string(),
                )
            }),
        Some(_) => Err(MigrationError::ValidationFailed(
            "schemaVersion は数値である必要があります".to_string(),
        )),
    }
}

/// Migrate serialized content to the latest schema using an adjacent chain.
///
/// Returns an error (without writing anything) for unknown future versions,
/// gaps in the migration chain, or failures inside a migration step.
pub fn run_migrations(
    content: &str,
    chain: &[Migration],
    latest_version: u32,
) -> Result<MigrationOutcome, MigrationError> {
    let from_version = detect_version(content)?;
    if from_version > latest_version {
        return Err(MigrationError::FutureVersion {
            found: from_version,
            latest: latest_version,
        });
    }

    let mut data: serde_json::Value = serde_json::from_str(content)
        .map_err(|error| MigrationError::InvalidJson(error.to_string()))?;
    let mut applied = Vec::new();
    let mut current = from_version;
    while current < latest_version {
        let migration = chain
            .iter()
            .find(|candidate| candidate.from_version == current)
            .ok_or(MigrationError::ChainGap {
                from_version: current,
            })?;
        if migration.to_version != current + 1 {
            return Err(MigrationError::ChainGap {
                from_version: current,
            });
        }
        data = (migration.apply)(&data).map_err(|message| MigrationError::MigrationFailed {
            from_version: current,
            to_version: migration.to_version,
            message,
        })?;
        applied.push(migration.name);
        current = migration.to_version;
    }

    Ok(MigrationOutcome {
        from_version,
        data,
        applied,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bump_version_migration(from_version: u32) -> Migration {
        Migration {
            from_version,
            to_version: from_version + 1,
            name: "bump-version",
            apply: Box::new(move |data| {
                let mut data = data.clone();
                data["schemaVersion"] = serde_json::Value::from(from_version + 1);
                Ok(data)
            }),
        }
    }

    fn failing_migration(from_version: u32) -> Migration {
        Migration {
            from_version,
            to_version: from_version + 1,
            name: "failing",
            apply: Box::new(|_| Err("intentional failure".to_string())),
        }
    }

    #[test]
    fn detect_version_treats_missing_field_as_zero() {
        assert_eq!(detect_version("{}").unwrap(), 0);
        assert_eq!(detect_version(r#"{"schemaVersion":3}"#).unwrap(), 3);
    }

    #[test]
    fn detect_version_rejects_non_numeric_schema_version() {
        let error = detect_version(r#"{"schemaVersion":"1"}"#).unwrap_err();
        assert!(matches!(error, MigrationError::ValidationFailed(_)));
    }

    #[test]
    fn detect_version_reports_corrupted_json() {
        let error = detect_version("{not valid json").unwrap_err();
        assert!(matches!(error, MigrationError::InvalidJson(_)));
    }

    #[test]
    fn run_migrations_stays_unchanged_at_latest_version() {
        let content = r#"{"schemaVersion":2,"data":{"value":1}}"#;
        let chain = [bump_version_migration(0), bump_version_migration(1)];
        let outcome = run_migrations(content, &chain, 2).unwrap();

        assert_eq!(outcome.from_version, 2);
        assert!(outcome.applied.is_empty());
        assert_eq!(outcome.data["data"]["value"], 1);
    }

    #[test]
    fn run_migrations_links_adjacent_steps_from_intermediate_version() {
        let content = r#"{"schemaVersion":1,"data":{"value":1}}"#;
        let chain = [bump_version_migration(0), bump_version_migration(1)];
        let outcome = run_migrations(content, &chain, 2).unwrap();

        assert_eq!(outcome.from_version, 1);
        assert_eq!(outcome.applied, vec!["bump-version"]);
        assert_eq!(outcome.data["schemaVersion"], 2);
        assert_eq!(outcome.data["data"]["value"], 1);
    }

    #[test]
    fn run_migrations_applies_whole_chain_from_version_zero() {
        let content = r#"{"value":1}"#;
        let chain = [bump_version_migration(0), bump_version_migration(1)];
        let outcome = run_migrations(content, &chain, 2).unwrap();

        assert_eq!(outcome.from_version, 0);
        assert_eq!(outcome.applied, vec!["bump-version", "bump-version"]);
        assert_eq!(outcome.data["schemaVersion"], 2);
        assert_eq!(outcome.data["value"], 1);
    }

    #[test]
    fn run_migrations_rejects_unknown_future_version_without_changes() {
        let content = r#"{"schemaVersion":99,"data":{}}"#;
        let chain = [bump_version_migration(0)];
        let error = run_migrations(content, &chain, 1).unwrap_err();

        assert_eq!(
            error,
            MigrationError::FutureVersion {
                found: 99,
                latest: 1
            }
        );
        assert!(error.to_string().contains("v99"));
    }

    #[test]
    fn run_migrations_reports_chain_gap() {
        let content = r#"{"schemaVersion":0,"data":{}}"#;
        let chain = [bump_version_migration(1)];
        let error = run_migrations(content, &chain, 2).unwrap_err();

        assert_eq!(error, MigrationError::ChainGap { from_version: 0 });
    }

    #[test]
    fn run_migrations_reports_skipping_chain_step() {
        let content = r#"{"schemaVersion":0,"data":{}}"#;
        let chain = [Migration {
            from_version: 0,
            to_version: 2,
            name: "skip",
            apply: Box::new(|data| Ok(data.clone())),
        }];
        let error = run_migrations(content, &chain, 2).unwrap_err();

        assert_eq!(error, MigrationError::ChainGap { from_version: 0 });
    }

    #[test]
    fn run_migrations_reports_step_failure() {
        let content = r#"{"schemaVersion":0,"data":{}}"#;
        let chain = [failing_migration(0)];
        let error = run_migrations(content, &chain, 1).unwrap_err();

        assert_eq!(
            error,
            MigrationError::MigrationFailed {
                from_version: 0,
                to_version: 1,
                message: "intentional failure".to_string()
            }
        );
    }
}
