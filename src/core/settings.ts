import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "./context/AppSettings";

export const loadSettings = () => invoke<AppSettings>("load_settings");

export const saveSettings = (settings: AppSettings) =>
  invoke<void>("save_settings", { settings });

export const loadApiKey = (service: "voice_to_text") =>
  invoke<string>("load_api_key", { service });

export const saveApiKey = (service: "voice_to_text", key: string) =>
  invoke<void>("save_api_key", { service, key });
