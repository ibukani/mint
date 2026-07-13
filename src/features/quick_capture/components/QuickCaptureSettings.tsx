import type React from "react";
import { useFeatureSettings } from "../../../core/hooks/useFeatureSettings";
import { Field, SettingsSection, TextInput } from "../../../design/components";

export const QuickCaptureSettings: React.FC = () => {
  const {
    featureSettings: settings,
    handleChange,
    shortcutError,
  } = useFeatureSettings("quickCapture");

  if (!settings) return null;

  return (
    <SettingsSection
      title="クイックキャプチャー"
      description="アプリを開かず、下書きやメモをすぐ呼び出します。"
    >
      <Field
        id="quick_capture-enabled-checkbox"
        label="機能を有効化する"
        orientation="inline"
      >
        <TextInput
          id="quick_capture-enabled-checkbox"
          type="checkbox"
          checked={settings.enabled}
          onChange={() => handleChange("enabled", !settings.enabled)}
        />
      </Field>

      <Field
        id="quick_capture-shortcut-input"
        label="ショートカットキー"
        error={shortcutError}
      >
        <TextInput
          id="quick_capture-shortcut-input"
          type="text"
          invalid={Boolean(shortcutError)}
          value={settings.shortcut}
          onChange={(e) => handleChange("shortcut", e.target.value)}
          placeholder="例: Alt+2"
        />
      </Field>
    </SettingsSection>
  );
};
