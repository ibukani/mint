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

const PRESET_COLORS = [
  { value: "#818cf8", label: "インディゴ" },
  { value: "#38bdf8", label: "スカイ" },
  { value: "#34d399", label: "ミント" },
  { value: "#fbbf24", label: "アンバー" },
  { value: "#fb7185", label: "ローズ" },
  { value: "#f8fafc", label: "ホワイト" },
] as const;

export const GameLauncherSettings: React.FC = () => {
  const {
    featureSettings: settings,
    handleChange,
    updateFeatureSettings,
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
        onReset={() => updateFeatureSettings(defaultAppSettings.gameLauncher)}
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
        <Field
          id="game-launcher-theme-color-picker"
          label="ランチャーのテーマカラー"
        >
          <div className="color-picker-palette">
            {PRESET_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                className={`color-picker-badge ${settings.themeColor === color.value ? "is-active" : ""}`}
                style={{ "--swatch-color": color.value } as React.CSSProperties}
                title={color.label}
                onClick={() => handleChange("themeColor", color.value)}
                aria-label={color.label}
                aria-pressed={settings.themeColor === color.value}
              />
            ))}
          </div>
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
