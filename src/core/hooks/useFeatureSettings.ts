import { type AppSettings, useAppSettings } from "../context/AppSettings";

export function useFeatureSettings<
  K extends Exclude<keyof AppSettings, "theme">,
>(featureKey: K) {
  const { settings, updateSettings, shortcutErrors } = useAppSettings();
  const featureSettings = settings ? settings[featureKey] : null;
  const shortcutError = shortcutErrors[featureKey] || "";

  const handleChange = <P extends keyof AppSettings[K]>(
    key: P,
    value: AppSettings[K][P],
  ) => {
    if (!settings) return;
    updateSettings((prev) => ({
      ...prev,
      [featureKey]: {
        ...prev[featureKey],
        [key]: value,
      },
    }));
  };

  return { featureSettings, handleChange, shortcutError };
}
