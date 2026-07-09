import type React from "react";
import { defaultAppSettings } from "../../../core/defaultSettings";
import { useFeatureSettings } from "../../../core/hooks/useFeatureSettings";
import {
  Button,
  Field,
  FieldRow,
  Select,
  SettingsSection,
  ShortcutInput,
  TextInput,
  UnitLabel,
} from "../../../design/components";
import {
  CLOCK_AUTO_HIDE_MAX_SECONDS,
  CLOCK_AUTO_HIDE_MIN_SECONDS,
  normalizeAutoHideSeconds,
} from "../settings";
import { TickingClock } from "./ClockOverlay";

const PRESET_COLORS = [
  { value: "#818cf8", label: "インディゴ (Indigo)" },
  { value: "#c084fc", label: "バイオレット (Violet)" },
  { value: "#38bdf8", label: "シアン (Cyan)" },
  { value: "#34d399", label: "エメラルド (Emerald)" },
  { value: "#f43f5e", label: "ローズ (Rose)" },
  { value: "#ffffff", label: "ホワイト (White)" },
] as const;

export const ClockSettings: React.FC = () => {
  const {
    featureSettings: clock,
    handleChange,
    shortcutError,
  } = useFeatureSettings("clock");

  if (!clock) return null;

  const resetClockSettings = () => {
    handleChange("enabled", defaultAppSettings.clock.enabled);
    handleChange("shortcut", defaultAppSettings.clock.shortcut);
    handleChange("autoHideSeconds", defaultAppSettings.clock.autoHideSeconds);
    handleChange("fontSize", defaultAppSettings.clock.fontSize);
    handleChange("showDate", defaultAppSettings.clock.showDate);
    handleChange("showSeconds", defaultAppSettings.clock.showSeconds);
    handleChange("clockColor", defaultAppSettings.clock.clockColor);
    handleChange("blinkColon", defaultAppSettings.clock.blinkColon);
    const shortcutInput = document.getElementById(
      "clock-shortcut-input",
    ) as HTMLInputElement | null;
    shortcutInput?.focus();
    shortcutInput?.select();
  };

  const changeAutoHideSeconds = (delta: number) => {
    handleChange(
      "autoHideSeconds",
      Math.max(
        CLOCK_AUTO_HIDE_MIN_SECONDS,
        Math.min(CLOCK_AUTO_HIDE_MAX_SECONDS, clock.autoHideSeconds + delta),
      ),
    );
    const autoHideSecondsInput = document.getElementById(
      "clock-hide-seconds-input",
    ) as HTMLInputElement | null;
    autoHideSecondsInput?.focus();
    autoHideSecondsInput?.select();
  };

  return (
    <SettingsSection
      title="時計オーバーレイ設定"
      description="ショートカットキーを押した際に画面上に表示される時計のカスタマイズを行います。"
    >
      <div className="feature-settings-toolbar">
        <div className="feature-settings-actions">
          <Button variant="ghost" onClick={resetClockSettings}>
            デフォルトに戻す
          </Button>
        </div>
      </div>

      <Field
        id="clock-enabled-checkbox"
        label="この機能を有効にする (Enable Feature)"
        orientation="inline"
      >
        <TextInput
          id="clock-enabled-checkbox"
          type="checkbox"
          checked={clock.enabled}
          onChange={(e) => handleChange("enabled", e.target.checked)}
        />
      </Field>

      <Field
        id="clock-shortcut-input"
        label="起動ショートカットキー"
        error={shortcutError}
        helpText="入力欄をクリックしてキーを押すことでショートカットキーを変更できます。"
      >
        <ShortcutInput
          id="clock-shortcut-input"
          autoFocus
          invalid={Boolean(shortcutError)}
          value={clock.shortcut}
          onChange={(value) => handleChange("shortcut", value)}
          placeholderText="例: Ctrl+Alt+C"
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
          <Button
            variant="ghost"
            onClick={() => changeAutoHideSeconds(-1)}
            disabled={clock.autoHideSeconds <= CLOCK_AUTO_HIDE_MIN_SECONDS}
            aria-label="表示秒数を1秒減らす"
          >
            -
          </Button>
          <Button
            variant="ghost"
            onClick={() => changeAutoHideSeconds(1)}
            disabled={clock.autoHideSeconds >= CLOCK_AUTO_HIDE_MAX_SECONDS}
            aria-label="表示秒数を1秒増やす"
          >
            +
          </Button>
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

      <Field
        id="clock-show-date-checkbox"
        label="年月日と曜日を表示する"
        orientation="inline"
        helpText="時計の下に年月日と曜日を表示します。"
      >
        <TextInput
          id="clock-show-date-checkbox"
          type="checkbox"
          checked={clock.showDate}
          onChange={(e) => handleChange("showDate", e.target.checked)}
        />
      </Field>

      <Field
        id="clock-show-seconds-checkbox"
        label="秒数を表示する"
        orientation="inline"
        helpText="時刻表示に秒数を含めます。"
      >
        <TextInput
          id="clock-show-seconds-checkbox"
          type="checkbox"
          checked={clock.showSeconds}
          onChange={(e) => handleChange("showSeconds", e.target.checked)}
        />
      </Field>

      <Field
        id="clock-blink-colon-checkbox"
        label="コロンを点滅させる"
        orientation="inline"
        helpText="時間と分の間のコロン「:」を1秒おきに点滅させます。"
      >
        <TextInput
          id="clock-blink-colon-checkbox"
          type="checkbox"
          checked={clock.blinkColon}
          onChange={(e) => handleChange("blinkColon", e.target.checked)}
        />
      </Field>

      <Field id="clock-color-picker" label="時計のテーマカラー">
        <div className="color-picker-palette">
          {PRESET_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              className={`color-picker-badge ${
                clock.clockColor === color.value ? "is-active" : ""
              }`}
              style={{ backgroundColor: color.value }}
              title={color.label}
              onClick={() => handleChange("clockColor", color.value)}
              aria-label={color.label}
            />
          ))}
        </div>
      </Field>

      <div className="clock-preview-section">
        <h3 className="clock-preview-title">ライブプレビュー (Live Preview)</h3>
        <div className="clock-preview-card-wrapper">
          <div
            className="overlay-card is-visible"
            style={
              {
                position: "relative",
                width: "300px",
                height: "110px",
                margin: 0,
                fontSize: clock.fontSize,
                "--clock-accent-color": clock.clockColor,
              } as React.CSSProperties
            }
          >
            <div className="overlay-clock-content">
              <TickingClock
                showDate={clock.showDate}
                showSeconds={clock.showSeconds}
                blinkColon={clock.blinkColon}
              />
            </div>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
};
