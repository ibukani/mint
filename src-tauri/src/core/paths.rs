use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Returns the E2E data base directory when the `MINT_E2E_DATA_DIR`
/// environment variable is set on a debug build. E2E tests run against a
/// debug binary and must never touch real user data, so every path resolver
/// routes through this base when present.
fn e2e_base_dir() -> Option<PathBuf> {
    if !cfg!(debug_assertions) {
        return None;
    }
    std::env::var_os("MINT_E2E_DATA_DIR").map(PathBuf::from)
}

/// Resolves the application data directory. Under E2E tests the location is
/// redirected into the directory configured with `MINT_E2E_DATA_DIR`.
pub fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(base) = e2e_base_dir() {
        return Ok(base.join("data"));
    }
    app.path().app_data_dir().map_err(|error| error.to_string())
}

/// Resolves the application config directory. Under E2E tests the location
/// is redirected into the directory configured with `MINT_E2E_DATA_DIR`.
pub fn app_config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(base) = e2e_base_dir() {
        return Ok(base.join("config"));
    }
    app.path()
        .app_config_dir()
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn e2e_base_dir_ignores_missing_variable() {
        std::env::remove_var("MINT_E2E_DATA_DIR");
        assert_eq!(e2e_base_dir(), None);
    }

    #[test]
    fn e2e_base_dir_reads_configured_variable() {
        std::env::set_var("MINT_E2E_DATA_DIR", "C:\\e2e\\mint-test");
        let base = e2e_base_dir().expect("base dir must be set");
        assert_eq!(base, PathBuf::from("C:\\e2e\\mint-test"));
    }
}
