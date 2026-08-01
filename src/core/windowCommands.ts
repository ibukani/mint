import { invoke } from "@tauri-apps/api/core";
import type { SettingsTabId } from "./navigation/settingsTabs";

export type OverlayTarget =
  | "clock"
  | "calendar"
  | "gameLauncher"
  | "quickCapture"
  | "fileShelf"
  | "mintPalette";

const overlayTargets: readonly OverlayTarget[] = [
  "clock",
  "calendar",
  "gameLauncher",
  "quickCapture",
  "fileShelf",
  "mintPalette",
];

export const isOverlayTarget = (value: string): value is OverlayTarget =>
  overlayTargets.includes(value as OverlayTarget);

export const openOverlay = (target: OverlayTarget) =>
  invoke<void>("open_overlay", { target });

export const notifyOverlayReady = () => invoke<void>("overlay_ready");

export type WindowStateTarget =
  | "main"
  | "quickCapture"
  | "gameLauncher"
  | "calendar"
  | "calendarEditor";

export const resetWindowState = (label: WindowStateTarget) =>
  invoke<void>("reset_window_state", { label });

export interface SettingsTabRequest {
  tab: SettingsTabId;
  targetId?: string | null;
}

export const openSettingsTab = (tab: SettingsTabId, targetId?: string) =>
  invoke<void>("open_settings_tab", { tab, targetId });

export const takePendingSettingsTab = () =>
  invoke<SettingsTabRequest | null>("take_pending_settings_tab");
