import type { AppSettings } from "./context/AppSettings";

export const defaultAppSettings: AppSettings = {
  theme: "dark",
  settingsShortcut: "Ctrl+Alt+S",
  clock: {
    enabled: true,
    shortcut: "Ctrl+Alt+C",
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
    shortcut: "Ctrl+Alt+V",
    baseUrl: "https://api.openai.com/v1",
    model: "whisper-1",
    language: "ja",
    status: "available",
  },
};
