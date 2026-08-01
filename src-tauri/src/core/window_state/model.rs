use serde::{Deserialize, Serialize};
use tauri::WebviewWindow;

use super::WINDOW_STATE_VERSION;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedWindowState {
    pub version: u32,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub monitor_id: Option<String>,
    pub maximized: bool,
}

impl PersistedWindowState {
    pub fn capture(window: &WebviewWindow) -> Result<Self, String> {
        let position = window.outer_position().map_err(|error| error.to_string())?;
        let size = window.outer_size().map_err(|error| error.to_string())?;
        let scale = window.scale_factor().map_err(|error| error.to_string())?;
        let monitor_id = window
            .current_monitor()
            .ok()
            .flatten()
            .and_then(|monitor| monitor.name().map(|name| name.to_string()));
        let maximized = window.is_maximized().map_err(|error| error.to_string())?;

        Ok(PersistedWindowState {
            version: WINDOW_STATE_VERSION,
            x: (position.x as f64 / scale).round() as i32,
            y: (position.y as f64 / scale).round() as i32,
            width: (size.width as f64 / scale).round() as u32,
            height: (size.height as f64 / scale).round() as u32,
            monitor_id,
            maximized,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_with_camel_case_fields() {
        let state = PersistedWindowState {
            version: 1,
            x: 100,
            y: 200,
            width: 800,
            height: 600,
            monitor_id: Some("\\\\.\\DISPLAY1".to_string()),
            maximized: false,
        };
        let json = serde_json::to_string(&state).unwrap();
        assert!(json.contains("\"monitorId\""));
        assert!(json.contains("\"maximized\""));
        assert!(!json.contains("\"monitor_id\""));
    }

    #[test]
    fn deserializes_camel_case_fields() {
        let json = r#"{"version":1,"x":10,"y":20,"width":300,"height":200,"monitorId":"DISPLAY1","maximized":true}"#;
        let state: PersistedWindowState = serde_json::from_str(json).unwrap();
        assert_eq!(state.x, 10);
        assert_eq!(state.monitor_id.as_deref(), Some("DISPLAY1"));
        assert!(state.maximized);
    }
}
