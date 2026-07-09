import type { AppSettings } from "./context/AppSettings";

export const defaultAppSettings: AppSettings = {
  theme: "dark",
  clock: {
    shortcut: "Ctrl+Alt+C",
    autoHideSeconds: 3,
    fontSize: "1.5rem",
    showDate: true,
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
