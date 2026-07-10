import type React from "react";
import { defaultAppSettings } from "../../../core/defaultSettings";
import { useFeatureSettings } from "../../../core/hooks/useFeatureSettings";
import {
  FeatureSettingsHeader,
  Field,
  SettingsSection,
  ShortcutInput,
} from "../../../design/components";

export const CalendarSettings: React.FC = () => {
  const {
    featureSettings: calendar,
    handleChange,
    shortcutError,
  } = useFeatureSettings("calendar");

  if (!calendar) return null;

  const resetCalendarSettings = () => {
    handleChange("enabled", defaultAppSettings.calendar.enabled);
    handleChange("shortcut", defaultAppSettings.calendar.shortcut);
  };

  return (
    <SettingsSection
      title="カレンダー設定"
      description="月間カレンダーをすばやく呼び出し、時計の直下へ表示します。"
    >
      <FeatureSettingsHeader
        switchId="calendar-enabled-checkbox"
        label="カレンダー"
        enabled={calendar.enabled}
        onChange={(event) => handleChange("enabled", event.target.checked)}
        onReset={resetCalendarSettings}
        ariaLabel="カレンダーを有効にする"
      />

      <Field
        id="calendar-shortcut-input"
        label="起動ショートカットキー"
        error={shortcutError}
        helpText="時計が表示中なら直下に開き、非表示なら時計と一緒に開きます。"
      >
        <ShortcutInput
          id="calendar-shortcut-input"
          invalid={Boolean(shortcutError)}
          value={calendar.shortcut}
          onChange={(value) => handleChange("shortcut", value)}
          placeholderText="例: Alt+Down"
        />
      </Field>
    </SettingsSection>
  );
};
