import type { AppSettings } from "../settingsModel";

export const settingsAreEqual = (
  left: AppSettings | null,
  right: AppSettings,
) => JSON.stringify(left) === JSON.stringify(right);

export const requiresImmediateSettingsSave = (
  previous: AppSettings,
  next: AppSettings,
) =>
  previous.autostart !== next.autostart ||
  previous.theme !== next.theme ||
  previous.settingsShortcut !== next.settingsShortcut ||
  previous.clock.enabled !== next.clock.enabled ||
  previous.clock.shortcut !== next.clock.shortcut ||
  previous.calendar.enabled !== next.calendar.enabled ||
  previous.calendar.shortcut !== next.calendar.shortcut ||
  previous.calendar.createEventShortcut !== next.calendar.createEventShortcut ||
  previous.gameLauncher.enabled !== next.gameLauncher.enabled ||
  previous.gameLauncher.shortcut !== next.gameLauncher.shortcut ||
  previous.voiceToText.enabled !== next.voiceToText.enabled ||
  previous.voiceToText.shortcut !== next.voiceToText.shortcut;
