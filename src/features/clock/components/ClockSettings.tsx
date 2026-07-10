import { Minus, Palette, Plus, TimerReset } from "lucide-react";
import type React from "react";
import { defaultAppSettings } from "../../../core/defaultSettings";
import { useFeatureSettings } from "../../../core/hooks/useFeatureSettings";
import {
  Button,
  FeatureSettingsHeader,
  Field,
  FieldRow,
  Select,
  SettingsSection,
  ShortcutInput,
  Switch,
  TextInput,
  UnitLabel,
} from "../../../design/components";
import {
  CLOCK_AUTO_HIDE_MAX_SECONDS,
  CLOCK_AUTO_HIDE_MIN_SECONDS,
  normalizeAutoHideSeconds,
} from "../settings";
import { getClockDimensions, TickingClock } from "./ClockOverlay";

const PRESET_COLORS = [
  { value: "#818cf8", label: "インディゴ" },
  { value: "#38bdf8", label: "スカイ" },
  { value: "#34d399", label: "ミント" },
  { value: "#fbbf24", label: "アンバー" },
  { value: "#fb7185", label: "ローズ" },
  { value: "#f8fafc", label: "ホワイト" },
] as const;

export const ClockSettings: React.FC = () => {
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
    const input = document.getElementById(
      "clock-hide-seconds-input",
    ) as HTMLInputElement | null;
    input?.focus();
    input?.select();
  };

  const previewDimensions = getClockDimensions(
    clock.displayMode,
    clock.showDate,
  );

  return (
    <SettingsSection
      title="時計オーバーレイ設定"
      description="呼び出した瞬間に時刻を確認できる、軽量なデスクトップ時計です。"
    >
      <FeatureSettingsHeader
        switchId="clock-enabled-checkbox"
        label="時計オーバーレイ"
        enabled={clock.enabled}
        onChange={(event) => handleChange("enabled", event.target.checked)}
        onReset={resetClockSettings}
      />

      <div className="clock-settings-workspace">
        <div className="clock-settings-controls">
          <section
            className="clock-control-group"
            aria-labelledby="clock-behavior-title"
          >
            <div className="clock-control-group__heading">
              <TimerReset size={17} aria-hidden="true" />
              <div>
                <h3 id="clock-behavior-title">呼び出し</h3>
                <p>表示するキーと閉じるタイミング</p>
              </div>
            </div>
            <Field
              id="clock-shortcut-input"
              label="起動ショートカットキー"
              error={shortcutError}
              helpText="入力欄を選択して、使いたいキーの組み合わせを押します。"
            >
              <ShortcutInput
                id="clock-shortcut-input"
                invalid={Boolean(shortcutError)}
                value={clock.shortcut}
                onChange={(value) => handleChange("shortcut", value)}
                placeholderText="例: Ctrl+Alt+C"
              />
            </Field>
            <Field
              id="clock-hide-seconds-input"
              label="表示秒数 (0でトグル表示)"
              helpText="0秒では、もう一度ショートカットを押すまで表示します。"
            >
              <FieldRow>
                <Button
                  variant="ghost"
                  className="clock-step-button"
                  onClick={() => changeAutoHideSeconds(-1)}
                  disabled={
                    clock.autoHideSeconds <= CLOCK_AUTO_HIDE_MIN_SECONDS
                  }
                  aria-label="表示秒数を1秒減らす"
                >
                  <Minus size={16} aria-hidden="true" />
                </Button>
                <TextInput
                  id="clock-hide-seconds-input"
                  type="number"
                  min={String(CLOCK_AUTO_HIDE_MIN_SECONDS)}
                  max={String(CLOCK_AUTO_HIDE_MAX_SECONDS)}
                  controlSize="number"
                  value={clock.autoHideSeconds}
                  onChange={(event) =>
                    handleChange(
                      "autoHideSeconds",
                      normalizeAutoHideSeconds(event.target.value),
                    )
                  }
                />
                <UnitLabel>秒</UnitLabel>
                <Button
                  variant="ghost"
                  className="clock-step-button"
                  onClick={() => changeAutoHideSeconds(1)}
                  disabled={
                    clock.autoHideSeconds >= CLOCK_AUTO_HIDE_MAX_SECONDS
                  }
                  aria-label="表示秒数を1秒増やす"
                >
                  <Plus size={16} aria-hidden="true" />
                </Button>
              </FieldRow>
            </Field>
          </section>

          <section
            className="clock-control-group"
            aria-labelledby="clock-style-title"
          >
            <div className="clock-control-group__heading">
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
              <Field id="clock-font-size-select" label="フォントサイズ">
                <Select
                  id="clock-font-size-select"
                  value={clock.fontSize}
                  onChange={(event) =>
                    handleChange("fontSize", event.target.value)
                  }
                >
                  <option value="1.2rem">小</option>
                  <option value="1.5rem">標準</option>
                  <option value="2rem">大</option>
                  <option value="2.5rem">特大</option>
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
                      handleChange(
                        "hourFormat",
                        event.target.value as "12h" | "24h",
                      )
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
                        Math.min(
                          250,
                          Number.parseInt(event.target.value, 10) || 100,
                        ),
                      ),
                    )
                  }
                />
                <UnitLabel>%</UnitLabel>
              </div>
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
                    style={
                      { "--swatch-color": color.value } as React.CSSProperties
                    }
                    title={color.label}
                    onClick={() => handleChange("clockColor", color.value)}
                    aria-label={color.label}
                    aria-pressed={clock.clockColor === color.value}
                  />
                ))}
              </div>
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
                  onChange={(event) =>
                    handleChange("showDate", event.target.checked)
                  }
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
        </div>

        <aside
          className="clock-preview-panel"
          aria-label="時計のライブプレビュー"
        >
          <div className="clock-preview-header">
            <div>
              <span className="clock-preview-kicker">ライブプレビュー</span>
              <h3>
                {clock.displayMode === "digital"
                  ? "デジタル時計"
                  : "アナログ時計"}
              </h3>
            </div>
            <span className="clock-preview-scale">{clock.sizePercent}%</span>
          </div>
          <div className="clock-preview-stage">
            <div
              className={`overlay-card clock-preview-card overlay-card--${clock.displayMode} is-visible`}
              style={
                {
                  "--preview-width": `${previewDimensions.width}px`,
                  "--preview-height": `${previewDimensions.height}px`,
                  "--overlay-font-size": clock.fontSize,
                  "--clock-accent-color": clock.clockColor,
                  "--clock-size-scale": Math.min(clock.sizePercent / 100, 1.15),
                } as React.CSSProperties
              }
            >
              <div className="overlay-clock-content">
                <TickingClock
                  showDate={clock.showDate}
                  showSeconds={clock.showSeconds}
                  blinkColon={clock.blinkColon}
                  displayMode={clock.displayMode}
                  hourFormat={clock.hourFormat}
                  glowEffect={clock.glowEffect}
                  clockColor={clock.clockColor}
                />
              </div>
            </div>
          </div>
          <p className="clock-preview-note">
            変更は即座に反映され、自動で保存されます。
          </p>
        </aside>
      </div>
    </SettingsSection>
  );
};
