import type { AppSettings } from "./settingsModel";

export const defaultAppSettings: AppSettings = {
  autostart: false,
  theme: "dark",
  settingsShortcut: "Ctrl+Alt+S",
  clock: {
    enabled: true,
    shortcut: "Alt+Left",
    autoHideSeconds: 3,
    showDate: true,
    showSeconds: true,
    clockColor: "#818cf8",
    blinkColon: true,
    sizePercent: 100,
    displayMode: "digital",
    hourFormat: "24h",
    glowEffect: true,
  },
  voiceToText: {
    enabled: false,
    shortcut: "Alt+End",
    baseUrl: "https://api.openai.com/v1",
    model: "whisper-1",
    language: "ja",
    status: "available",
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
  quickCapture: {
    enabled: true,
    shortcut: "Alt+2",
  },
  fileShelf: {
    enabled: true,
    shortcut: "Alt+3",
    edge: "right",
    edgeHandleEnabled: true,
  },
};
