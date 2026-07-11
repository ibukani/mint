import type { AppSettings } from "../context/AppSettings";
import { defaultAppSettings } from "../defaultSettings";

const defaultMockSettings: AppSettings = {
  gameLauncher: {
    enabled: defaultAppSettings.gameLauncher.enabled,
    shortcut: defaultAppSettings.gameLauncher.shortcut,
  },

  calendar: {
    enabled: defaultAppSettings.calendar.enabled,
    shortcut: defaultAppSettings.calendar.shortcut,
    createEventShortcut: defaultAppSettings.calendar.createEventShortcut,
    selectedGoogleCalendarIds:
      defaultAppSettings.calendar.selectedGoogleCalendarIds,
    defaultGoogleCalendarId:
      defaultAppSettings.calendar.defaultGoogleCalendarId,
    themeColor: defaultAppSettings.calendar.themeColor,
  },

  autostart: defaultAppSettings.autostart,
  theme: defaultAppSettings.theme,
  settingsShortcut: defaultAppSettings.settingsShortcut,
  clock: {
    enabled: defaultAppSettings.clock.enabled,
    shortcut: defaultAppSettings.clock.shortcut,
    autoHideSeconds: defaultAppSettings.clock.autoHideSeconds,
    showDate: defaultAppSettings.clock.showDate,
    showSeconds: defaultAppSettings.clock.showSeconds,
    clockColor: defaultAppSettings.clock.clockColor,
    blinkColon: defaultAppSettings.clock.blinkColon,
    sizePercent: defaultAppSettings.clock.sizePercent,
    displayMode: defaultAppSettings.clock.displayMode,
    hourFormat: defaultAppSettings.clock.hourFormat,
    glowEffect: defaultAppSettings.clock.glowEffect,
  },
  voiceToText: {
    enabled: defaultAppSettings.voiceToText.enabled,
    shortcut: defaultAppSettings.voiceToText.shortcut,
    baseUrl: defaultAppSettings.voiceToText.baseUrl,
    model: defaultAppSettings.voiceToText.model,
    language: defaultAppSettings.voiceToText.language,
    status: defaultAppSettings.voiceToText.status,
  },
};

export const createMockSettings = (
  overrides?: Partial<AppSettings>,
): AppSettings => ({
  ...defaultMockSettings,
  ...overrides,
});
