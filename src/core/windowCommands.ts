import { invoke } from "@tauri-apps/api/core";

export type OverlayTarget =
  | "clock"
  | "calendar"
  | "gameLauncher"
  | "quickCapture"
  | "fileShelf";

const overlayTargets: readonly OverlayTarget[] = [
  "clock",
  "calendar",
  "gameLauncher",
  "quickCapture",
  "fileShelf",
];

export const isOverlayTarget = (value: string): value is OverlayTarget =>
  overlayTargets.includes(value as OverlayTarget);

export const openOverlay = (target: OverlayTarget) =>
  invoke<void>("open_overlay", { target });

export const notifyOverlayReady = () => invoke<void>("overlay_ready");
