import type React from "react";
import { Field, Select, SettingsSection } from "../../../design/components";
import { useAppSettings } from "../../context/AppSettings";

export const GeneralSettings: React.FC = () => {
  const { settings, updateSettings } = useAppSettings();

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
    </SettingsSection>
  );
};
