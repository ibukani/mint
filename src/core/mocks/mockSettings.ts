import { defaultAppSettings } from "../defaultSettings";
import type { AppSettings } from "../settingsModel";

const defaultMockSettings: AppSettings = {
  mintPalette: {
    enabled: defaultAppSettings.mintPalette.enabled,
    shortcut: defaultAppSettings.mintPalette.shortcut,
  },

  gameLauncher: {
    enabled: defaultAppSettings.gameLauncher.enabled,
    shortcut: defaultAppSettings.gameLauncher.shortcut,
    themeColor: defaultAppSettings.gameLauncher.themeColor,
    favoriteGameKeys: defaultAppSettings.gameLauncher.favoriteGameKeys,
    lastPlayedAtByGame: defaultAppSettings.gameLauncher.lastPlayedAtByGame,
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
    themeColor: defaultAppSettings.clock.themeColor,
    blinkColon: defaultAppSettings.clock.blinkColon,
    sizePercent: defaultAppSettings.clock.sizePercent,
    displayMode: defaultAppSettings.clock.displayMode,
    hourFormat: defaultAppSettings.clock.hourFormat,
    glowEffect: defaultAppSettings.clock.glowEffect,
  },

  // ブラウザモックは既存ユーザー扱いにする。
  // オンボーディングを検証するテストは overrides で completedVersion: 0 を渡す。
  onboarding: {
    completedVersion: 1,
  },
};

export const createMockSettings = (
  overrides?: Partial<AppSettings>,
): AppSettings => ({
  ...defaultMockSettings,
  ...overrides,
});
