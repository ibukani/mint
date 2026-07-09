import { Keyboard, MonitorCog, Moon, Sun } from "lucide-react";
import type React from "react";
import {
  Field,
  Select,
  SettingsSection,
  ShortcutInput,
} from "../../../design/components";
import { useAppSettings } from "../../context/AppSettings";

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
          <Field id="theme-select" label="テーマ設定">
            <Select
              id="theme-select"
              value={settings.theme}
              autoFocus
              onChange={(e) =>
                updateSettings({ theme: e.target.value as "dark" | "light" })
              }
            >
              <option value="dark">ダーク</option>
              <option value="light">ライト</option>
            </Select>
          </Field>
          <div className="theme-preview" aria-hidden="true">
            <div
              className={`theme-preview__tile ${settings.theme === "dark" ? "is-active" : ""}`}
            >
              <Moon size={18} />
              <span>ダーク</span>
            </div>
            <div
              className={`theme-preview__tile ${settings.theme === "light" ? "is-active" : ""}`}
            >
              <Sun size={18} />
              <span>ライト</span>
            </div>
          </div>
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
      </div>
    </SettingsSection>
  );
};
