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
      description="アプリケーション全体の基本的な挙動を設定します。"
    >
      <Field id="theme-select" label="テーマ設定">
        <Select
          id="theme-select"
          value={settings.theme}
          autoFocus
          onChange={(e) =>
            updateSettings({ theme: e.target.value as "dark" | "light" })
          }
        >
          <option value="dark">ダークモード (Dark)</option>
          <option value="light">ライトモード (Light)</option>
        </Select>
      </Field>

      <Field
        id="settings-shortcut-input"
        label="設定画面表示ショートカット"
        error={shortcutErrors.settings}
      >
        <ShortcutInput
          id="settings-shortcut-input"
          value={settings.settingsShortcut}
          invalid={!!shortcutErrors.settings}
          onChange={(val) => updateSettings({ settingsShortcut: val })}
        />
      </Field>
    </SettingsSection>
  );
};
