import { Check, Keyboard, MonitorCog, Moon, Power, Sun } from "lucide-react";
import "./GeneralSettings.css";
import type React from "react";
import {
  Field,
  SettingsSection,
  ShortcutInput,
  Switch,
} from "../../../design/components";
import { useAppSettings } from "../../context/AppSettings";
import { UpdaterSettings } from "./UpdaterSettings";

const themeOptions = [
  {
    value: "dark",
    label: "ダーク",
    description: "目にやさしい暗色テーマ",
    icon: Moon,
  },
  {
    value: "light",
    label: "ライト",
    description: "明るく見やすいテーマ",
    icon: Sun,
  },
] as const;

export const GeneralSettings: React.FC = () => {
  const { settings, updateSettings, shortcutErrors } = useAppSettings();

  if (!settings) return null;

  return (
    <SettingsSection
      title="一般設定"
      description="mint の外観と、設定画面をすばやく呼び出す方法を管理します。"
    >
      <div className="general-settings-layout">
        <section className="settings-group" aria-labelledby="appearance-title">
          <div className="settings-group__heading">
            <MonitorCog size={18} aria-hidden="true" />
            <div>
              <h3 id="appearance-title">外観</h3>
              <p>作業環境に合う表示テーマを選択します。</p>
            </div>
          </div>
          <Field label="テーマ設定">
            <div
              className="theme-choice-grid"
              role="radiogroup"
              aria-label="テーマ設定"
            >
              {themeOptions.map(({ value, label, description, icon: Icon }) => {
                const isActive = settings.theme === value;
                return (
                  <label
                    key={value}
                    className={`theme-choice-card ${isActive ? "is-active" : ""}`}
                  >
                    <input
                      className="theme-choice-card__input"
                      type="radio"
                      name="theme"
                      value={value}
                      checked={isActive}
                      aria-label={label}
                      onChange={() => updateSettings({ theme: value })}
                    />
                    <span
                      className={`theme-choice-card__preview theme-choice-card__preview--${value}`}
                    >
                      <span />
                    </span>
                    <span className="theme-choice-card__content">
                      <span className="theme-choice-card__label">
                        <Icon size={16} aria-hidden="true" />
                        {label}
                      </span>
                      <span className="theme-choice-card__description">
                        {description}
                      </span>
                    </span>
                    <Check
                      className="theme-choice-card__check"
                      size={16}
                      aria-hidden="true"
                    />
                  </label>
                );
              })}
            </div>
          </Field>
        </section>

        <section className="settings-group" aria-labelledby="shortcut-title">
          <div className="settings-group__heading">
            <Keyboard size={18} aria-hidden="true" />
            <div>
              <h3 id="shortcut-title">クイックアクセス</h3>
              <p>ほかのアプリを使用中でも設定画面を開けます。</p>
            </div>
          </div>
          <Field
            id="settings-shortcut-input"
            label="設定画面表示ショートカット"
            helpText="入力欄を選択して、使いたいキーの組み合わせを押します。"
            error={shortcutErrors.settings}
          >
            <ShortcutInput
              id="settings-shortcut-input"
              value={settings.settingsShortcut}
              invalid={!!shortcutErrors.settings}
              onChange={(val) => updateSettings({ settingsShortcut: val })}
            />
          </Field>
        </section>

        <section className="settings-group" aria-labelledby="system-title">
          <div className="settings-group__heading">
            <Power size={18} aria-hidden="true" />
            <div>
              <h3 id="system-title">システム</h3>
              <p>OS連携に関する設定を行います。</p>
            </div>
          </div>
          <Field
            id="general-autostart-input"
            label="PC起動時に自動で起動する"
            helpText="アプリのウィンドウはバックグラウンドで待機します。"
          >
            <Switch
              id="general-autostart-input"
              checked={settings.autostart}
              onChange={(e) => updateSettings({ autostart: e.target.checked })}
            />
          </Field>
        </section>

        <UpdaterSettings />
      </div>
    </SettingsSection>
  );
};
