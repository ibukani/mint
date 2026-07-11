import { Gamepad2, Keyboard } from "lucide-react";
import type React from "react";
import { defaultAppSettings } from "../../../core/defaultSettings";
import { useFeatureSettings } from "../../../core/hooks/useFeatureSettings";
import {
  FeatureSettingsHeader,
  Field,
  SettingsSection,
  ShortcutInput,
} from "../../../design/components";

export const GameLauncherSettings: React.FC = () => {
  const {
    featureSettings: settings,
    handleChange,
    shortcutError,
  } = useFeatureSettings("gameLauncher");

  if (!settings) return null;

  return (
    <SettingsSection
      title="ゲームランチャー"
      description="Steam、Epic Games、Riot Gamesのインストール済みゲームを一箇所から起動します。"
    >
      <FeatureSettingsHeader
        switchId="game-launcher-enabled"
        label="ゲームランチャー"
        enabled={settings.enabled}
        onChange={(event) => handleChange("enabled", event.target.checked)}
        onReset={() => {
          handleChange("enabled", defaultAppSettings.gameLauncher.enabled);
          handleChange("shortcut", defaultAppSettings.gameLauncher.shortcut);
        }}
        ariaLabel="ゲームランチャーを有効にする"
      />
      <section
        className="settings-group"
        aria-labelledby="game-launcher-shortcut-title"
      >
        <div className="settings-group__heading">
          <Keyboard size={18} aria-hidden="true" />
          <div>
            <h3 id="game-launcher-shortcut-title">呼び出し操作</h3>
            <p>中央のオーバーレイをどのアプリからでも開きます。</p>
          </div>
        </div>
        <Field
          id="game-launcher-shortcut"
          label="起動ショートカットキー"
          error={shortcutError}
          helpText="同じキーでもう一度押すか、Escで閉じます。"
        >
          <ShortcutInput
            id="game-launcher-shortcut"
            invalid={Boolean(shortcutError)}
            value={settings.shortcut}
            onChange={(value) => handleChange("shortcut", value)}
            placeholderText="例: Alt+1"
          />
        </Field>
      </section>
      <section
        className="settings-group"
        aria-labelledby="game-launcher-sources-title"
      >
        <div className="settings-group__heading">
          <Gamepad2 size={18} aria-hidden="true" />
          <div>
            <h3 id="game-launcher-sources-title">対応ランチャー</h3>
            <p>Steam・Epic Games・Riot Gamesをローカルで検出します。</p>
          </div>
        </div>
      </section>
    </SettingsSection>
  );
};
