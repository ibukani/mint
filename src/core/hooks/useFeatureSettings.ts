import { useCallback } from "react";
import { useAppSettings } from "../context/AppSettings";
import type { AppSettings, FeatureSettingsKey } from "../settingsModel";

export function useFeatureSettings<K extends FeatureSettingsKey>(
  featureKey: K,
) {
  const { settings, updateSettings, shortcutErrors } = useAppSettings();
  const featureSettings = settings ? settings[featureKey] : null;
  const shortcutError = shortcutErrors[featureKey] || "";

  const updateFeatureSettings = useCallback(
    (patch: Partial<AppSettings[K]>) => {
      updateSettings((previous) => ({
        ...previous,
        [featureKey]: {
          ...previous[featureKey],
          ...patch,
        },
      }));
    },
    [featureKey, updateSettings],
  );

  const handleChange = useCallback(
    <P extends keyof AppSettings[K]>(key: P, value: AppSettings[K][P]) => {
      updateSettings((previous) => ({
        ...previous,
        [featureKey]: {
          ...previous[featureKey],
          [key]: value,
        },
      }));
    },
    [featureKey, updateSettings],
  );

  return {
    featureSettings,
    handleChange,
    updateFeatureSettings,
    shortcutError,
  };
}
