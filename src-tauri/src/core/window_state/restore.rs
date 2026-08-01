use tauri::{AppHandle, PhysicalPosition, PhysicalSize, WebviewWindow};

use super::policy::policy_for;
use super::repository::{self, window_state_dir};

/// Minimum visible area (in logical pixels) that must remain on screen after
/// clamping, so the user can always grab and move the window back.
pub const MIN_VISIBLE_AREA: f64 = 48.0;

struct SizeBounds {
    min_width: Option<u32>,
    min_height: Option<u32>,
    max_width: Option<u32>,
    max_height: Option<u32>,
    maximizable: bool,
}

/// Physical monitor geometry used for clamping.
struct MonitorBounds {
    left: i32,
    top: i32,
    width: u32,
    height: u32,
    scale: f64,
}

/// Restores the window position/size from persisted state.
///
/// Returns `Ok(true)` when a stored state was applied, `Ok(false)` when the
/// window has no policy or no stored state, and `Err` when a window operation
/// fails. Callers should fall back to their default placement when the result
/// is `Ok(false)`.
pub fn restore(app: &AppHandle, window: &WebviewWindow) -> Result<bool, String> {
    let label = window.label();
    let Some(policy) = policy_for(label) else {
        return Ok(false);
    };
    let dir = window_state_dir(app)?;
    let Some(state) = repository::load(&dir, label) else {
        return Ok(false);
    };

    let Some(monitor) = resolve_monitor(window, state.monitor_id.as_deref()) else {
        return Ok(false);
    };
    let scale = monitor.scale_factor();
    let monitor_position = monitor.position();
    let monitor_size = monitor.size();
    let monitor = MonitorBounds {
        left: monitor_position.x,
        top: monitor_position.y,
        width: monitor_size.width,
        height: monitor_size.height,
        scale,
    };

    let bounds = bounds_from_config(app, label);

    let (logical_width, logical_height) = clamp_dimensions(
        state.width,
        state.height,
        &bounds,
        monitor.width as f64 / scale,
        monitor.height as f64 / scale,
    );
    let (logical_x, logical_y) = clamp_to_screen(
        state.x as f64,
        state.y as f64,
        logical_width,
        logical_height,
        &monitor,
    );

    if policy.persist_size && logical_width > 0 && logical_height > 0 {
        let physical_width = (logical_width as f64 * scale).round() as u32;
        let physical_height = (logical_height as f64 * scale).round() as u32;
        window
            .set_size(PhysicalSize::new(physical_width, physical_height))
            .map_err(|error| format!("ウィンドウサイズを復元できませんでした: {error}"))?;
    }
    if policy.persist_position {
        let physical_x = (logical_x * scale).round() as i32;
        let physical_y = (logical_y * scale).round() as i32;
        window
            .set_position(PhysicalPosition::new(physical_x, physical_y))
            .map_err(|error| format!("ウィンドウ位置を復元できませんでした: {error}"))?;
    }
    if state.maximized && bounds.maximizable {
        window
            .maximize()
            .map_err(|error| format!("ウィンドウを最大化できませんでした: {error}"))?;
    }

    Ok(true)
}

/// Finds the monitor matching the persisted `monitor_id`, falling back to the
/// window's current monitor, the primary monitor, then the first monitor.
fn resolve_monitor(window: &WebviewWindow, monitor_id: Option<&str>) -> Option<tauri::Monitor> {
    let monitors = window.available_monitors().ok()?;
    if let Some(id) = monitor_id {
        if let Some(monitor) = monitors
            .iter()
            .find(|monitor| monitor.name().map(String::as_str) == Some(id))
        {
            return Some(monitor.clone());
        }
    }
    window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten())
        .or_else(|| monitors.first().cloned())
}

fn bounds_from_config(app: &AppHandle, label: &str) -> SizeBounds {
    let Some(config) = app
        .config()
        .app
        .windows
        .iter()
        .find(|config| config.label == label)
    else {
        return SizeBounds {
            min_width: None,
            min_height: None,
            max_width: None,
            max_height: None,
            maximizable: false,
        };
    };
    SizeBounds {
        min_width: config.min_width.map(|value| value as u32),
        min_height: config.min_height.map(|value| value as u32),
        max_width: config.max_width.map(|value| value as u32),
        max_height: config.max_height.map(|value| value as u32),
        maximizable: config.maximizable,
    }
}

/// Clamps logical window dimensions to the configured min/max and the monitor
/// size (in logical pixels). Returns at least 1x1.
fn clamp_dimensions(
    width: u32,
    height: u32,
    bounds: &SizeBounds,
    monitor_width: f64,
    monitor_height: f64,
) -> (u32, u32) {
    let monitor_width = monitor_width.max(1.0);
    let monitor_height = monitor_height.max(1.0);
    let min_width = bounds
        .min_width
        .unwrap_or(1)
        .min(monitor_width as u32)
        .max(1);
    let min_height = bounds
        .min_height
        .unwrap_or(1)
        .min(monitor_height as u32)
        .max(1);
    let max_width = bounds
        .max_width
        .unwrap_or(monitor_width as u32)
        .min(monitor_width as u32)
        .max(min_width);
    let max_height = bounds
        .max_height
        .unwrap_or(monitor_height as u32)
        .min(monitor_height as u32)
        .max(min_height);
    (
        width.clamp(min_width, max_width),
        height.clamp(min_height, max_height),
    )
}

/// Clamps the window's logical top-left so that at least `MIN_VISIBLE_AREA`
/// logical pixels stay visible on the given physical monitor.
fn clamp_to_screen(x: f64, y: f64, width: u32, height: u32, monitor: &MonitorBounds) -> (f64, f64) {
    let monitor_left = monitor.left as f64 / monitor.scale;
    let monitor_top = monitor.top as f64 / monitor.scale;
    let monitor_width = monitor.width as f64 / monitor.scale;
    let monitor_height = monitor.height as f64 / monitor.scale;
    let visible = MIN_VISIBLE_AREA.min(monitor_width).min(monitor_height);

    let min_x = monitor_left - width as f64 + visible;
    let max_x = monitor_left + monitor_width - visible;
    let x = if min_x > max_x {
        monitor_left
    } else {
        x.clamp(min_x, max_x)
    };

    let min_y = monitor_top - height as f64 + visible;
    let max_y = monitor_top + monitor_height - visible;
    let y = if min_y > max_y {
        monitor_top
    } else {
        y.clamp(min_y, max_y)
    };

    (x, y)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bounds(
        min_width: Option<u32>,
        min_height: Option<u32>,
        max_width: Option<u32>,
        max_height: Option<u32>,
    ) -> SizeBounds {
        SizeBounds {
            min_width,
            min_height,
            max_width,
            max_height,
            maximizable: false,
        }
    }

    fn monitor(left: i32, top: i32, width: u32, height: u32, scale: f64) -> MonitorBounds {
        MonitorBounds {
            left,
            top,
            width,
            height,
            scale,
        }
    }

    #[test]
    fn clamp_dimensions_keeps_window_inside_monitor() {
        let (width, height) =
            clamp_dimensions(2000, 2000, &bounds(None, None, None, None), 1920.0, 1080.0);
        assert_eq!(width, 1920);
        assert_eq!(height, 1080);
    }

    #[test]
    fn clamp_dimensions_respects_minimum() {
        let (width, height) = clamp_dimensions(
            10,
            10,
            &bounds(Some(680), Some(520), None, None),
            1920.0,
            1080.0,
        );
        assert_eq!(width, 680);
        assert_eq!(height, 520);
    }

    #[test]
    fn clamp_dimensions_respects_maximum() {
        let (width, height) = clamp_dimensions(
            1200,
            800,
            &bounds(None, None, Some(1000), Some(700)),
            1920.0,
            1080.0,
        );
        assert_eq!(width, 1000);
        assert_eq!(height, 700);
    }

    #[test]
    fn clamp_dimensions_minimum_never_exceeds_monitor() {
        let (width, height) = clamp_dimensions(
            10,
            10,
            &bounds(Some(4000), Some(4000), None, None),
            1920.0,
            1080.0,
        );
        assert_eq!(width, 1920);
        assert_eq!(height, 1080);
    }

    #[test]
    fn clamp_dimensions_never_returns_zero() {
        let (width, height) = clamp_dimensions(
            0,
            0,
            &bounds(Some(0), Some(0), Some(0), Some(0)),
            800.0,
            600.0,
        );
        assert!(width >= 1);
        assert!(height >= 1);
    }

    #[test]
    fn clamp_to_screen_moves_offscreen_window_back() {
        let (x, y) = clamp_to_screen(5000.0, 5000.0, 800, 600, &monitor(0, 0, 1920, 1080, 1.0));
        assert!(x <= 1920.0 - MIN_VISIBLE_AREA + 0.001);
        assert!(x + 800.0 >= MIN_VISIBLE_AREA - 0.001);
        assert!(y <= 1080.0 - MIN_VISIBLE_AREA + 0.001);
        assert!(y + 600.0 >= MIN_VISIBLE_AREA - 0.001);
    }

    #[test]
    fn clamp_to_screen_keeps_window_visible_on_negative_monitors() {
        let (x, y) = clamp_to_screen(
            -5000.0,
            -5000.0,
            800,
            600,
            &monitor(-1920, 0, 1920, 1080, 1.0),
        );
        assert!(x >= -1920.0 - 800.0 + MIN_VISIBLE_AREA - 0.001);
        assert!(x <= -1920.0 + 1920.0 - MIN_VISIBLE_AREA + 0.001);
        assert!(x + 800.0 >= -1920.0 + MIN_VISIBLE_AREA - 0.001);
        assert!(y + 600.0 >= 0.0 + MIN_VISIBLE_AREA - 0.001);
    }

    #[test]
    fn clamp_to_screen_handles_windows_larger_than_monitor() {
        let (x, y) = clamp_to_screen(10.0, 10.0, 3000, 2000, &monitor(0, 0, 1920, 1080, 1.0));
        assert!(x >= -3000.0 + MIN_VISIBLE_AREA - 0.001);
        assert!(x <= 1920.0 - MIN_VISIBLE_AREA + 0.001);
        assert!(y >= -2000.0 + MIN_VISIBLE_AREA - 0.001);
        assert!(y <= 1080.0 - MIN_VISIBLE_AREA + 0.001);
    }

    #[test]
    fn clamp_to_screen_keeps_window_visible_with_scale() {
        let (x, y) = clamp_to_screen(2000.0, 1000.0, 800, 600, &monitor(0, 0, 2560, 1440, 2.0));
        assert!(x <= 1280.0 - MIN_VISIBLE_AREA + 0.001);
        assert!(x + 800.0 >= MIN_VISIBLE_AREA - 0.001);
        assert!(y <= 720.0 - MIN_VISIBLE_AREA + 0.001);
        assert!(y + 600.0 >= MIN_VISIBLE_AREA - 0.001);
    }
}
