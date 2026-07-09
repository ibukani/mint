import type { AppSettings } from "./context/AppSettings";

export const defaultAppSettings: AppSettings = {
  theme: "dark",
  clock: {
    enabled: true,
    shortcut: "Ctrl+Alt+C",
    autoHideSeconds: 3,
    fontSize: "1.5rem",
    showDate: true,
    showSeconds: true,
    clockColor: "#818cf8",
    blinkColon: true,
    sizePercent: 100,
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
