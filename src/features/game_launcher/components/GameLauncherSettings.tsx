import { Gamepad2, Keyboard, RefreshCw } from "lucide-react";
import type React from "react";
import { defaultAppSettings } from "../../../core/defaultSettings";
import { useFeatureSettings } from "../../../core/hooks/useFeatureSettings";
import {
  Button,
  FeatureSettingsHeader,
  Field,
  SettingsSection,
  ShortcutInput,
  StatusBadge,
} from "../../../design/components";
import { useGameSourceStatus } from "../hooks/useGameSourceStatus";
import type { GameStore } from "../types";
import "./GameLauncherSettings.css";

const PRESET_COLORS = [
  { value: "#818cf8", label: "インディゴ" },
  { value: "#38bdf8", label: "スカイ" },
  { value: "#34d399", label: "ミント" },
  { value: "#fbbf24", label: "アンバー" },
  { value: "#fb7185", label: "ローズ" },
  { value: "#f8fafc", label: "ホワイト" },
] as const;

const SUPPORTED_LAUNCHERS = [
  {
    store: "steam",
    name: "Steam",
    mark: "S",
    description: "Steamライブラリとインストール済みタイトル",
  },
  {
    store: "epic",
    name: "Epic Games",
    mark: "E",
    description: "Epic Games Launcherのローカルライブラリ",
  },
  {
    store: "riot",
    name: "Riot Games",
    mark: "R",
    description: "Riot Clientで利用できるゲーム",
  },
] as const satisfies ReadonlyArray<{
  store: GameStore;
  name: string;
  mark: string;
  description: string;
}>;

const getSourcePresentation = (
  phase: "loading" | "ready" | "error",
  source: { detected: boolean; warning: string | null } | undefined,
  gameCount: number,
) => {
  if (phase === "loading") {
    return { label: "確認中…", tone: "info" as const, count: "—" };
  }
  if (phase === "error") {
    return {
      label: "確認できません",
      tone: "error" as const,
      count: "—",
    };
  }
  if (!source) {
    return { label: "未確認", tone: "disabled" as const, count: "—" };
  }
  if (source.warning) {
    return {
      label: "一部読み取りエラー",
      tone: "error" as const,
      count: `${gameCount}本`,
    };
  }
  if (!source.detected) {
    return { label: "未検出", tone: "disabled" as const, count: "—" };
  }
  return {
    label: "検出済み",
    tone: "available" as const,
    count: `${gameCount}本`,
  };
};

export const GameLauncherSettings: React.FC = () => {
  const {
    phase: sourceScanPhase,
    sources,
    gameCounts,
    error: sourceScanError,
    scan: scanGameSources,
  } = useGameSourceStatus();
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
        <div className="game-launcher-sources-header">
          <div className="settings-group__heading">
            <Gamepad2 size={18} aria-hidden="true" />
            <div>
              <h3 id="game-launcher-sources-title">対応ランチャー</h3>
              <p>Steam・Epic Games・Riot Gamesをローカルで検出します。</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="game-launcher-sources-refresh"
            onClick={() => void scanGameSources()}
            disabled={sourceScanPhase === "loading"}
            aria-label="対応ランチャーを再確認"
          >
            <RefreshCw
              size={15}
              aria-hidden="true"
              className={
                sourceScanPhase === "loading"
                  ? "game-launcher-sources-refresh__icon is-spinning"
                  : "game-launcher-sources-refresh__icon"
              }
            />
            {sourceScanPhase === "loading" ? "確認中…" : "再確認"}
          </Button>
        </div>
        {sourceScanError && (
          <p className="game-launcher-source-error" role="alert">
            ランチャーを確認できませんでした。再確認してください。
          </p>
        )}
        <div className="game-launcher-source-list">
          {SUPPORTED_LAUNCHERS.map((launcher) => {
            const source = sources.find(
              (item) => item.store === launcher.store,
            );
            const presentation = getSourcePresentation(
              sourceScanPhase,
              source,
              gameCounts[launcher.store],
            );
            return (
              <article className="game-launcher-source" key={launcher.name}>
                <span className="game-launcher-source__mark" aria-hidden="true">
                  {launcher.mark}
                </span>
                <div className="game-launcher-source__copy">
                  <h4>{launcher.name}</h4>
                  <p>{launcher.description}</p>
                </div>
                <div className="game-launcher-source__meta">
                  <StatusBadge tone={presentation.tone}>
                    {presentation.label}
                  </StatusBadge>
                  <span className="game-launcher-source__count">
                    {presentation.count}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
        <p className="game-launcher-source-note">
          ライブラリ情報はこのPC上でのみ確認され、外部へ送信されません。
        </p>
      </section>
    </SettingsSection>
  );
};
