import type React from "react";
import { useSettingsNavigation } from "../../../core/context/SettingsNavigation";
import { defaultAppSettings } from "../../../core/defaultSettings";
import { useFeatureSettings } from "../../../core/hooks/useFeatureSettings";
import { normalizeShortcut } from "../../../core/shortcuts";
import {
  Button,
  Field,
  FieldRow,
  Select,
  SettingsSection,
  TextInput,
  UnitLabel,
} from "../../../design/components";
import {
  CLOCK_AUTO_HIDE_MAX_SECONDS,
  CLOCK_AUTO_HIDE_MIN_SECONDS,
  normalizeAutoHideSeconds,
} from "../settings";

export const ClockSettings: React.FC = () => {
  const { setActiveTab } = useSettingsNavigation();
  const {
    featureSettings: clock,
    handleChange,
    shortcutError,
  } = useFeatureSettings("clock");

  if (!clock) return null;

  const resetClockSettings = () => {
    handleChange("shortcut", defaultAppSettings.clock.shortcut);
    handleChange("autoHideSeconds", defaultAppSettings.clock.autoHideSeconds);
    handleChange("fontSize", defaultAppSettings.clock.fontSize);
    document.getElementById("clock-shortcut-input")?.focus();
  };

  return (
    <SettingsSection
      title="時計オーバーレイ設定"
      description="ショートカットキーを押した際に画面右上に表示される時計のカスタマイズを行います。"
    >
      <div className="feature-settings-toolbar">
        <Button variant="ghost" onClick={() => setActiveTab("dashboard")}>
          機能管理に戻る
        </Button>
        <div className="feature-settings-actions">
          <Button variant="ghost" onClick={resetClockSettings}>
            デフォルトに戻す
          </Button>
        </div>
      </div>

      <Field
        id="clock-shortcut-input"
        label="起動ショートカットキー"
        error={shortcutError}
        helpText="Tauriのグローバルショートカットキー形式（例: CommandOrControl+Shift+C）で指定します。"
      >
        <TextInput
          id="clock-shortcut-input"
          type="text"
          autoFocus
          invalid={Boolean(shortcutError)}
          value={clock.shortcut}
          onChange={(e) => handleChange("shortcut", e.target.value)}
          onBlur={(e) =>
            handleChange("shortcut", normalizeShortcut(e.target.value))
          }
          placeholder="例: Ctrl+Alt+C"
        />
      </Field>

      <Field
        id="clock-hide-seconds-input"
        label="表示秒数 (0でトグル表示)"
        helpText="時計が表示されてから自動で消えるまでの秒数です。0に設定すると再度ショートカットを押すまで常時表示されます。"
      >
        <FieldRow>
          <TextInput
            id="clock-hide-seconds-input"
            type="number"
            min={String(CLOCK_AUTO_HIDE_MIN_SECONDS)}
            max={String(CLOCK_AUTO_HIDE_MAX_SECONDS)}
            controlSize="number"
            value={clock.autoHideSeconds}
            onChange={(e) =>
              handleChange(
                "autoHideSeconds",
                normalizeAutoHideSeconds(e.target.value),
              )
            }
          />
          <UnitLabel>秒</UnitLabel>
        </FieldRow>
      </Field>

      <Field id="clock-font-size-select" label="フォントサイズ">
        <Select
          id="clock-font-size-select"
          value={clock.fontSize}
          onChange={(e) => handleChange("fontSize", e.target.value)}
        >
          <option value="1.2rem">小 (1.2rem)</option>
          <option value="1.5rem">中 (1.5rem)</option>
          <option value="2rem">大 (2rem)</option>
          <option value="2.5rem">特大 (2.5rem)</option>
        </Select>
      </Field>
    </SettingsSection>
  );
};
