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
    themeColor: "#818cf8",
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
    themeColor: "#818cf8",
    fontFamily: "ui-monospace",
    fontSize: 16,
    lineHeight: 1.75,
    showLineNumbers: true,
    wordWrap: true,
    tabWidth: 2,
    spellCheck: true,
    highlightCurrentLine: false,
    alwaysOnTop: false,
  },
  fileShelf: {
    enabled: true,
    shortcut: "Alt+3",
    edge: "right",
    verticalPosition: "center",
    // Keep the WebView-backed edge handle opt-in so a fresh install does not
    // pay the resident WebView cost before the user needs the shelf.
    edgeHandleEnabled: false,
    clipboardHistoryEnabled: false,
    clipboardHistoryLimit: 25,
    ignoredApplications: [
      "1Password.exe",
      "Bitwarden.exe",
      "Dashlane.exe",
      "Enpass.exe",
      "KeePass.exe",
      "KeePassXC.exe",
      "LastPass.exe",
    ],
    themeColor: "#818cf8",
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
