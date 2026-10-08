import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "./settingsModel";

export const loadSettings = () => invoke<AppSettings>("load_settings");

export const saveSettings = (settings: AppSettings) =>
  invoke<void>("save_settings", { settings });
