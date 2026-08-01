import { Keyboard } from "lucide-react";
import type React from "react";
import { defaultAppSettings } from "../../../core/defaultSettings";
import { useFeatureSettings } from "../../../core/hooks/useFeatureSettings";
import {
  FeatureSettingsHeader,
  Field,
  SettingsSection,
  ShortcutInput,
} from "../../../design/components";
import "./MintPaletteSettings.css";

export const MintPaletteSettings: React.FC = () => {
  const {
    featureSettings: settings,
    handleChange,
    updateFeatureSettings,
    shortcutError,
  } = useFeatureSettings("mintPalette");

  if (!settings) return null;

  return (
    <SettingsSection
      title="MintPalette 設定"
      description="キーボードひとつで、機能や設定へすばやく移動できるグローバルコマンドパレットを設定します。"
    >
      <FeatureSettingsHeader
        switchId="mint-palette-enabled"
        label="MintPalette"
        enabled={settings.enabled}
        onChange={(event) => handleChange("enabled", event.target.checked)}
        onReset={() => updateFeatureSettings(defaultAppSettings.mintPalette)}
        ariaLabel="MintPaletteを有効にする"
      />

      <section
        className="settings-group"
        aria-labelledby="mint-palette-shortcut-title"
      >
        <div className="settings-group__heading">
          <Keyboard size={18} aria-hidden="true" />
          <div>
            <h3 id="mint-palette-shortcut-title">呼び出し操作</h3>
            <p>メインウィンドウでショートカットキーを押すと開きます。</p>
          </div>
        </div>
        <Field
          id="mint-palette-shortcut-input"
          label="起動ショートカットキー"
          error={shortcutError}
          helpText="入力欄を選択して、使いたいキーの組み合わせを押します。"
        >
          <ShortcutInput
            id="mint-palette-shortcut-input"
            invalid={Boolean(shortcutError)}
            value={settings.shortcut}
            onChange={(value) => handleChange("shortcut", value)}
            placeholderText="例: Ctrl+Alt+M"
          />
        </Field>
        <div className="mint-palette-shortcut-summary">
          <kbd>{settings.shortcut || "未設定"}</kbd>
          <span>で MintPalette を表示</span>
        </div>
      </section>
    </SettingsSection>
  );
};
