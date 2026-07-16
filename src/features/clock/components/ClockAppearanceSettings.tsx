import { Palette } from "lucide-react";
import type React from "react";
import {
  ColorPresetPicker,
  Field,
  Select,
  Switch,
  TextInput,
  UnitLabel,
} from "../../../design/components";
import type { ClockSettingsController } from "../hooks/useClockSettingsController";

export const ClockAppearanceSettings: React.FC<{
  controller: ClockSettingsController;
}> = ({ controller }) => {
  const { clock, handleChange } = controller;

  return (
    <section className="settings-group" aria-labelledby="clock-style-title">
      <div className="settings-group__heading">
        <Palette size={17} aria-hidden="true" />
        <div>
          <h3 id="clock-style-title">表示スタイル</h3>
          <p>文字盤、サイズ、アクセントカラー</p>
        </div>
      </div>
      <div className="clock-field-grid">
        <Field id="clock-display-mode-select" label="表示モード">
          <Select
            id="clock-display-mode-select"
            value={clock.displayMode}
            onChange={(event) =>
              handleChange(
                "displayMode",
                event.target.value as "digital" | "analog",
              )
            }
          >
            <option value="digital">デジタル</option>
            <option value="analog">アナログ</option>
          </Select>
        </Field>
        {clock.displayMode === "digital" && (
          <Field
            id="clock-hour-format-select"
            label="時間表記 (デジタル時のみ)"
          >
            <Select
              id="clock-hour-format-select"
              value={clock.hourFormat}
              onChange={(event) =>
                handleChange("hourFormat", event.target.value as "12h" | "24h")
              }
            >
              <option value="24h">24時間</option>
              <option value="12h">12時間（AM / PM）</option>
            </Select>
          </Field>
        )}
      </div>

      <Field id="clock-size-percent-input" label="時計のサイズ倍率">
        <div className="clock-range-control">
          <input
            className="clock-range"
            type="range"
            min="50"
            max="250"
            step="5"
            value={clock.sizePercent}
            onChange={(event) =>
              handleChange(
                "sizePercent",
                Number.parseInt(event.target.value, 10),
              )
            }
            aria-label="時計サイズスライダー"
          />
          <TextInput
            id="clock-size-percent-input"
            type="number"
            min="50"
            max="250"
            controlSize="number"
            value={clock.sizePercent}
            onChange={(event) =>
              handleChange(
                "sizePercent",
                Math.max(
                  50,
                  Math.min(250, Number.parseInt(event.target.value, 10) || 100),
                ),
              )
            }
          />
          <UnitLabel>%</UnitLabel>
        </div>
      </Field>

      <Field id="clock-color-picker" label="時計のテーマカラー">
        <ColorPresetPicker
          value={clock.clockColor}
          onChange={(value) => handleChange("clockColor", value)}
          ariaLabel="時計のテーマカラー"
        />
      </Field>

      <div className="clock-toggle-grid">
        <Field
          id="clock-show-date-checkbox"
          label="年月日と曜日を表示する"
          orientation="inline"
        >
          <Switch
            id="clock-show-date-checkbox"
            checked={clock.showDate}
            onChange={(event) => handleChange("showDate", event.target.checked)}
          />
        </Field>
        <Field
          id="clock-show-seconds-checkbox"
          label="秒数を表示する"
          orientation="inline"
        >
          <Switch
            id="clock-show-seconds-checkbox"
            checked={clock.showSeconds}
            onChange={(event) =>
              handleChange("showSeconds", event.target.checked)
            }
          />
        </Field>
        <Field
          id="clock-blink-colon-checkbox"
          label="コロンを点滅させる"
          orientation="inline"
        >
          <Switch
            id="clock-blink-colon-checkbox"
            checked={clock.blinkColon}
            onChange={(event) =>
              handleChange("blinkColon", event.target.checked)
            }
          />
        </Field>
        <Field
          id="clock-glow-effect-checkbox"
          label="ネオングロー効果を有効にする"
          orientation="inline"
        >
          <Switch
            id="clock-glow-effect-checkbox"
            checked={clock.glowEffect}
            onChange={(event) =>
              handleChange("glowEffect", event.target.checked)
            }
          />
        </Field>
      </div>
    </section>
  );
};
