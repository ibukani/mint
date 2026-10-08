import type { AppSettings } from "./settingsModel";

export const defaultAppSettings: AppSettings = {
  autostart: false,
  theme: "system",
  settingsShortcut: "Ctrl+Alt+S",
  clock: {
    enabled: true,
    shortcut: "Alt+Left",
    autoHideSeconds: 3,
    showDate: true,
    showSeconds: true,
    themeColor: "#818cf8",
    blinkColon: true,
    sizePercent: 100,
    displayMode: "digital",
    hourFormat: "24h",
    glowEffect: true,
  },
  calendar: {
    enabled: true,
    shortcut: "Alt+Down",
    createEventShortcut: "Alt+Up",
    selectedGoogleCalendarIds: [],
    defaultGoogleCalendarId: "",
    themeColor: "#818cf8",
  },
  gameLauncher: {
    enabled: true,
    shortcut: "Alt+1",
    themeColor: "#818cf8",
    favoriteGameKeys: [],
    lastPlayedAtByGame: {},
  },
  mintPalette: {
    enabled: false,
    shortcut: "Ctrl+Alt+M",
  },
  // 0 = 未完了。新規インストールでは初回セットアップを表示する。
  // 既存ユーザーはマイグレーションで完了バージョンが設定される。
  onboarding: {
    completedVersion: 0,
  },
};
