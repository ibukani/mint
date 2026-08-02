import { useCallback } from "react";
import {
  useSettingsSelector,
  useShortcutError,
  useUpdateSettings,
} from "../context/AppSettings";
import type { AppSettings, FeatureSettingsKey } from "../settingsModel";

export function useFeatureSettings<K extends FeatureSettingsKey>(
  featureKey: K,
) {
  const featureSettings = useSettingsSelector(
    useCallback((state) => state.settings?.[featureKey] ?? null, [featureKey]),
  );
  const shortcutError = useShortcutError(featureKey);
  const updateSettings = useUpdateSettings();

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
