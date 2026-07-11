import { CalendarDays, Clock3, Keyboard, MoveDown } from "lucide-react";
import type React from "react";
import { useAppSettings } from "../../../core/context/AppSettings";
import { defaultAppSettings } from "../../../core/defaultSettings";
import { useFeatureSettings } from "../../../core/hooks/useFeatureSettings";
import {
  FeatureSettingsHeader,
  Field,
  SettingsSection,
  ShortcutInput,
} from "../../../design/components";
import "./CalendarSettings.css";
import { GoogleCalendarSettings } from "./GoogleCalendarSettings";

const PRESET_COLORS = [
  { value: "#818cf8", label: "インディゴ" },
  { value: "#38bdf8", label: "スカイ" },
  { value: "#34d399", label: "ミント" },
  { value: "#fbbf24", label: "アンバー" },
  { value: "#fb7185", label: "ローズ" },
  { value: "#f8fafc", label: "ホワイト" },
] as const;

export const CalendarSettings: React.FC = () => {
  const { shortcutErrors } = useAppSettings();
  const {
    featureSettings: calendar,
    handleChange,
    updateFeatureSettings,
    shortcutError,
  } = useFeatureSettings("calendar");

  if (!calendar) return null;

  const resetCalendarSettings = () => {
    updateFeatureSettings(defaultAppSettings.calendar);
  };

  return (
    <div
      className="theme-accent-scope"
      style={{ "--color-accent": calendar.themeColor } as React.CSSProperties}
    >
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

        <div className="calendar-settings-grid">
          <GoogleCalendarSettings />
          <section
            className="settings-group"
            aria-labelledby="calendar-shortcut-title"
          >
            <div className="settings-group__heading">
              <Keyboard size={18} aria-hidden="true" />
              <div>
                <h3 id="calendar-shortcut-title">呼び出し操作</h3>
                <p>どのアプリを使用中でもすぐに月表示を開けます。</p>
              </div>
            </div>
            <Field
              id="calendar-shortcut-input"
              label="起動ショートカットキー"
              error={shortcutError}
              helpText="入力欄を選択して、使いたいキーの組み合わせを押します。"
            >
              <ShortcutInput
                id="calendar-shortcut-input"
                invalid={Boolean(shortcutError)}
                value={calendar.shortcut}
                onChange={(value) => handleChange("shortcut", value)}
                placeholderText="例: Alt+Down"
              />
            </Field>
            <Field
              id="calendar-create-event-shortcut-input"
              label="予定登録ショートカットキー"
              error={shortcutErrors.calendarCreateEvent}
              helpText="カレンダーを開かず、予定入力画面へ直接移動します。"
            >
              <ShortcutInput
                id="calendar-create-event-shortcut-input"
                invalid={Boolean(shortcutErrors.calendarCreateEvent)}
                value={calendar.createEventShortcut}
                onChange={(value) => handleChange("createEventShortcut", value)}
                placeholderText="例: Alt+Up"
              />
            </Field>
            <Field
              id="calendar-theme-color-picker"
              label="カレンダーのテーマカラー"
            >
              <div className="color-picker-palette">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={`color-picker-badge ${calendar.themeColor === color.value ? "is-active" : ""}`}
                    style={
                      { "--swatch-color": color.value } as React.CSSProperties
                    }
                    title={color.label}
                    onClick={() => handleChange("themeColor", color.value)}
                    aria-label={color.label}
                    aria-pressed={calendar.themeColor === color.value}
                  />
                ))}
              </div>
            </Field>
          </section>

          <section
            className="settings-group calendar-behavior-card"
            aria-labelledby="calendar-behavior-title"
          >
            <div className="settings-group__heading">
              <CalendarDays size={18} aria-hidden="true" />
              <div>
                <h3 id="calendar-behavior-title">表示の流れ</h3>
                <p>現在の時計表示に自然につながる配置で開きます。</p>
              </div>
            </div>
            <div
              className="calendar-behavior-flow"
              role="img"
              aria-label="時計の下にカレンダーが表示されます"
            >
              <div className="calendar-behavior-flow__item">
                <Clock3 size={18} aria-hidden="true" />
                <span>時計を確認</span>
              </div>
              <MoveDown size={16} aria-hidden="true" />
              <div className="calendar-behavior-flow__item is-accented">
                <CalendarDays size={18} aria-hidden="true" />
                <span>直下に月表示</span>
              </div>
            </div>
            <p className="calendar-behavior-note">
              時計が非表示の場合は、時計とカレンダーをまとめて表示します。
            </p>
          </section>
        </div>
      </SettingsSection>
    </div>
  );
};
