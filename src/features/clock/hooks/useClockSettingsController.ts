import { defaultAppSettings } from "../../../core/defaultSettings";
import { useFeatureSettings } from "../../../core/hooks/useFeatureSettings";
import { getClockDimensions } from "../components/ClockDisplay";
import {
  CLOCK_AUTO_HIDE_MAX_SECONDS,
  CLOCK_AUTO_HIDE_MIN_SECONDS,
} from "../settings";

const focusAndSelect = (id: string) => {
  const input = document.getElementById(id);
  if (input instanceof HTMLInputElement) {
    input.focus();
    input.select();
  }
};

export const useClockSettingsController = () => {
  const {
    featureSettings: clock,
    handleChange,
    shortcutError,
  } = useFeatureSettings("clock");

  if (!clock) return null;

  const resetClockSettings = () => {
    for (const key of Object.keys(defaultAppSettings.clock) as Array<
      keyof typeof defaultAppSettings.clock
    >) {
      handleChange(key, defaultAppSettings.clock[key]);
    }
    focusAndSelect("clock-shortcut-input");
  };

  const changeAutoHideSeconds = (delta: number) => {
    handleChange(
      "autoHideSeconds",
      Math.max(
        CLOCK_AUTO_HIDE_MIN_SECONDS,
        Math.min(CLOCK_AUTO_HIDE_MAX_SECONDS, clock.autoHideSeconds + delta),
      ),
    );
    focusAndSelect("clock-hide-seconds-input");
  };

  return {
    clock,
    handleChange,
    shortcutError,
    resetClockSettings,
    changeAutoHideSeconds,
    previewDimensions: getClockDimensions(clock.displayMode, clock.showDate),
  };
};

export type ClockSettingsController = NonNullable<
  ReturnType<typeof useClockSettingsController>
>;
