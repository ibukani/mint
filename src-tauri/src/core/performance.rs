use chrono::{SecondsFormat, Utc};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

use super::settings::AppSettingsState;
use crate::features::calendar::CalendarStoreState;
use crate::features::file_shelf::FileShelfStoreState;
use crate::features::quick_capture::QuickCaptureStoreState;

/// Maximum number of buffered performance events. Kept small so the
/// diagnostics payload stays bounded even on long-running sessions.
const MAX_EVENTS: usize = 500;
/// Maximum number of recent error messages kept for diagnostics.
const MAX_RECENT_ERRORS: usize = 5;

/// A single structured performance measurement.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceEvent {
    name: String,
    started_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    duration_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    window_label: Option<String>,
    #[serde(skip_serializing_if = "HashMap::is_empty")]
    metadata: HashMap<String, String>,
}

/// Tauri-managed registry for lifecycle counters, performance events, and
/// recent errors. Instrumentation is a no-op in release builds unless the
/// `MINT_PERFORMANCE_ENABLED` environment variable is set.
#[derive(Default)]
pub struct PerformanceRegistry {
    counters: Mutex<HashMap<String, u64>>,
    events: Mutex<Vec<PerformanceEvent>>,
    recent_errors: Mutex<Vec<String>>,
}

impl PerformanceRegistry {
    pub(crate) fn increment(&self, name: &str) {
        let mut counters = self
            .counters
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        *counters.entry(name.to_string()).or_insert(0) += 1;
    }

    pub(crate) fn set(&self, name: &str, value: u64) {
        let mut counters = self
            .counters
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        counters.insert(name.to_string(), value);
    }

    pub(crate) fn push_event(&self, event: PerformanceEvent) {
        let mut events = self
            .events
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let excess = events.len().saturating_add(1).saturating_sub(MAX_EVENTS);
        if excess > 0 {
            events.drain(..excess);
        }
        events.push(event);
    }

    pub(crate) fn push_error(&self, message: String) {
        let mut errors = self
            .recent_errors
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let excess = errors
            .len()
            .saturating_add(1)
            .saturating_sub(MAX_RECENT_ERRORS);
        if excess > 0 {
            errors.drain(..excess);
        }
        errors.push(message);
    }
}

/// Performance instrumentation is enabled in debug builds and can be opted
/// into for release builds with the `MINT_PERFORMANCE_ENABLED` variable.
pub fn performance_enabled() -> bool {
    if cfg!(debug_assertions) {
        return true;
    }
    std::env::var_os("MINT_PERFORMANCE_ENABLED").is_some()
}

fn registry(app: &AppHandle) -> Option<tauri::State<'_, PerformanceRegistry>> {
    app.try_state::<PerformanceRegistry>()
}

/// Records a lifecycle event. No-op when instrumentation is disabled or the
/// registry is not managed.
pub fn record_event(
    app: &AppHandle,
    name: &str,
    window_label: Option<&str>,
    duration_ms: Option<u64>,
    metadata: HashMap<String, String>,
) {
    if !performance_enabled() {
        return;
    }
    let Some(registry) = registry(app) else {
        return;
    };
    registry.push_event(PerformanceEvent {
        name: name.to_string(),
        started_at: Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
        duration_ms,
        window_label: window_label.map(str::to_string),
        metadata,
    });
}

/// Increments a lifecycle counter. No-op when instrumentation is disabled.
pub fn increment_counter(app: &AppHandle, name: &str) {
    if !performance_enabled() {
        return;
    }
    if let Some(registry) = registry(app) {
        registry.increment(name);
    }
}

/// Overwrites a lifecycle counter with an absolute value.
pub fn set_counter(app: &AppHandle, name: &str, value: u64) {
    if !performance_enabled() {
        return;
    }
    if let Some(registry) = registry(app) {
        registry.set(name, value);
    }
}

/// Records a recent error message for diagnostics. Kept even when
/// instrumentation is disabled so support reports stay useful.
pub fn record_error(app: &AppHandle, message: &str) {
    if let Some(registry) = registry(app) {
        registry.push_error(message.to_string());
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsEnvironment {
    os: String,
    arch: String,
    app_version: String,
    commit_sha: Option<String>,
    webview_version: Option<String>,
    debug_build: bool,
    performance_enabled: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsSettings {
    theme: String,
    autostart: bool,
    enabled_features: Vec<String>,
    shortcuts: HashMap<String, String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsReport {
    collected_at: String,
    environment: DiagnosticsEnvironment,
    settings: DiagnosticsSettings,
    windows: Vec<String>,
    counters: HashMap<String, u64>,
    events: Vec<PerformanceEvent>,
    data_counts: HashMap<String, u64>,
    recent_errors: Vec<String>,
}

fn collect_environment(app: &AppHandle) -> DiagnosticsEnvironment {
    DiagnosticsEnvironment {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        app_version: app.package_info().version.to_string(),
        commit_sha: std::env::var("MINT_COMMIT_SHA").ok(),
        webview_version: tauri::webview_version().ok(),
        debug_build: cfg!(debug_assertions),
        performance_enabled: performance_enabled(),
    }
}

fn collect_settings(settings: &super::settings::AppSettings) -> DiagnosticsSettings {
    let mut enabled_features = Vec::new();
    if settings.clock.enabled {
        enabled_features.push("clock".to_string());
    }
    if settings.calendar.enabled {
        enabled_features.push("calendar".to_string());
    }
    if settings.game_launcher.enabled {
        enabled_features.push("gameLauncher".to_string());
    }
    if settings.quick_capture.enabled {
        enabled_features.push("quickCapture".to_string());
    }
    if settings.file_shelf.enabled {
        enabled_features.push("fileShelf".to_string());
    }
    if settings.voice_to_text.enabled {
        enabled_features.push("voiceToText".to_string());
    }
    if settings.mint_palette.enabled {
        enabled_features.push("mintPalette".to_string());
    }
    let shortcuts = settings
        .active_shortcuts()
        .into_iter()
        .map(|(feature, key)| (feature.to_string(), key.to_string()))
        .collect();
    DiagnosticsSettings {
        theme: settings.theme.clone(),
        autostart: settings.autostart,
        enabled_features,
        shortcuts,
    }
}

fn collect_data_counts(
    quick_capture_state: &QuickCaptureStoreState,
    file_shelf_state: &FileShelfStoreState,
    calendar_state: &CalendarStoreState,
) -> HashMap<String, u64> {
    let mut counts = HashMap::new();
    if let Ok(state) =
        crate::features::quick_capture::count_quick_capture_notes(quick_capture_state)
    {
        counts.insert("quickCaptureNotes".to_string(), state);
    }
    if let Ok(state) = crate::features::file_shelf::count_file_shelf_items(file_shelf_state) {
        counts.insert("fileShelfItems".to_string(), state);
    }
    if let Ok(state) = crate::features::calendar::count_calendar_events(calendar_state) {
        counts.insert("calendarEvents".to_string(), state);
    }
    counts
}

/// Collects a diagnostics report for the settings screen. The report
/// deliberately excludes API keys, tokens, note/event content, and full
/// file paths.
#[tauri::command]
pub fn collect_diagnostics(
    app: tauri::AppHandle,
    settings_state: tauri::State<'_, AppSettingsState>,
    quick_capture_state: tauri::State<'_, QuickCaptureStoreState>,
    file_shelf_state: tauri::State<'_, FileShelfStoreState>,
    calendar_state: tauri::State<'_, CalendarStoreState>,
) -> Result<DiagnosticsReport, String> {
    let settings = settings_state
        .0
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .clone()
        .unwrap_or_default();
    let Some(registry) = registry(&app) else {
        return Err("計測レジストリが初期化されていません。".to_string());
    };

    let mut windows: Vec<String> = app.webview_windows().into_keys().collect();
    windows.sort();

    let counters = registry
        .counters
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .clone();
    let events = registry
        .events
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .clone();
    let recent_errors = registry
        .recent_errors
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .clone();

    Ok(DiagnosticsReport {
        collected_at: Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
        environment: collect_environment(&app),
        settings: collect_settings(&settings),
        windows,
        counters,
        events,
        data_counts: collect_data_counts(&quick_capture_state, &file_shelf_state, &calendar_state),
        recent_errors,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_counters_increment_and_overwrite() {
        let registry = PerformanceRegistry::default();
        registry.increment("windowsCreated");
        registry.increment("windowsCreated");
        assert_eq!(
            registry.counters.lock().unwrap().get("windowsCreated"),
            Some(&2)
        );

        registry.set("windowsCreated", 1);
        assert_eq!(
            registry.counters.lock().unwrap().get("windowsCreated"),
            Some(&1)
        );
    }

    #[test]
    fn registry_set_overwrites_absolute_value() {
        let registry = PerformanceRegistry::default();
        registry.set("monitorsDetected", 2);
        registry.increment("monitorsDetected");
        assert_eq!(
            registry.counters.lock().unwrap().get("monitorsDetected"),
            Some(&3)
        );
    }

    #[test]
    fn registry_bounds_events_and_recent_errors() {
        let registry = PerformanceRegistry::default();
        for index in 0..MAX_EVENTS + 10 {
            registry.push_event(PerformanceEvent {
                name: "window:created".to_string(),
                started_at: format!("2026-08-04T00:00:0{index:02}.000Z"),
                duration_ms: None,
                window_label: None,
                metadata: HashMap::new(),
            });
        }
        assert_eq!(registry.events.lock().unwrap().len(), MAX_EVENTS);

        for index in 0..MAX_RECENT_ERRORS + 2 {
            registry.push_error(format!("error {index}"));
        }
        let errors = registry.recent_errors.lock().unwrap().clone();
        assert_eq!(errors.len(), MAX_RECENT_ERRORS);
        assert_eq!(errors.first().map(String::as_str), Some("error 2"));
        assert_eq!(errors.last().map(String::as_str), Some("error 6"));
    }

    #[test]
    fn performance_is_enabled_in_debug_builds() {
        assert!(performance_enabled());
    }

    #[test]
    fn event_serialization_omits_optional_fields() {
        let minimal = PerformanceEvent {
            name: "window:created".to_string(),
            started_at: "2026-08-04T00:00:00.000Z".to_string(),
            duration_ms: None,
            window_label: None,
            metadata: HashMap::new(),
        };
        let json = serde_json::to_value(&minimal).unwrap();
        let object = json.as_object().unwrap();
        assert_eq!(object["name"], "window:created");
        assert!(!object.contains_key("durationMs"));
        assert!(!object.contains_key("windowLabel"));
        assert!(!object.contains_key("metadata"));

        let mut metadata = HashMap::new();
        metadata.insert("index".to_string(), "1".to_string());
        let full = PerformanceEvent {
            name: "overlay:opened".to_string(),
            started_at: "2026-08-04T00:00:00.000Z".to_string(),
            duration_ms: Some(42),
            window_label: Some("clock".to_string()),
            metadata,
        };
        let json = serde_json::to_value(&full).unwrap();
        let object = json.as_object().unwrap();
        assert_eq!(object["durationMs"], 42);
        assert_eq!(object["windowLabel"], "clock");
        assert_eq!(object["metadata"]["index"], "1");
    }

    #[test]
    fn diagnostics_report_contains_no_sensitive_content() {
        let report = DiagnosticsReport {
            collected_at: "2026-08-04T00:00:00.000Z".to_string(),
            environment: DiagnosticsEnvironment {
                os: "windows".to_string(),
                arch: "x86_64".to_string(),
                app_version: "0.3.1".to_string(),
                commit_sha: None,
                webview_version: None,
                debug_build: true,
                performance_enabled: true,
            },
            settings: DiagnosticsSettings {
                theme: "dark".to_string(),
                autostart: false,
                enabled_features: vec!["clock".to_string()],
                shortcuts: HashMap::new(),
            },
            windows: vec!["main".to_string()],
            counters: HashMap::new(),
            events: vec![PerformanceEvent {
                name: "window:created".to_string(),
                started_at: "2026-08-04T00:00:00.000Z".to_string(),
                duration_ms: None,
                window_label: Some("main".to_string()),
                metadata: HashMap::new(),
            }],
            data_counts: HashMap::new(),
            recent_errors: vec![],
        };

        let json = serde_json::to_value(&report).unwrap();
        let object = json.as_object().unwrap();
        for key in object.keys() {
            assert!(
                matches!(
                    key.as_str(),
                    "collectedAt"
                        | "environment"
                        | "settings"
                        | "windows"
                        | "counters"
                        | "events"
                        | "dataCounts"
                        | "recentErrors"
                ),
                "unexpected top-level key: {key}"
            );
        }
        let serialized = serde_json::to_string(&report).unwrap();
        for sensitive in [
            "apiKey",
            "api_key",
            "token",
            "secret",
            "notes",
            "title",
            "sourcePath",
            "path",
        ] {
            assert!(
                !serialized.contains(sensitive),
                "report leaked sensitive content: {sensitive}"
            );
        }
    }
}
