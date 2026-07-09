import type { AppSettings } from "../context/AppSettings";
import { defaultAppSettings } from "../defaultSettings";

const defaultMockSettings: AppSettings = {
  theme: defaultAppSettings.theme,
  clock: {
    enabled: defaultAppSettings.clock.enabled,
    shortcut: defaultAppSettings.clock.shortcut,
    autoHideSeconds: defaultAppSettings.clock.autoHideSeconds,
    fontSize: defaultAppSettings.clock.fontSize,
    showDate: defaultAppSettings.clock.showDate,
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
