import { useCallback } from "react";
import { type AppSettings, useAppSettings } from "../context/AppSettings";

export function useFeatureSettings<
  K extends Exclude<
    keyof AppSettings,
    "theme" | "settingsShortcut" | "autostart"
  >,
>(featureKey: K) {
  const { settings, updateSettings, shortcutErrors } = useAppSettings();
  const featureSettings = settings ? settings[featureKey] : null;
  const shortcutError = shortcutErrors[featureKey] || "";

  const handleChange = useCallback(
    <P extends keyof AppSettings[K]>(key: P, value: AppSettings[K][P]) => {
      updateSettings((prev) => ({
        ...prev,
        [featureKey]: {
          ...prev[featureKey],
          [key]: value,
        },
      }));
    },
    [featureKey, updateSettings],
  );

  return { featureSettings, handleChange, shortcutError };
}
