import {
  Archive,
  CalendarDays,
  Check,
  Clock3,
  Gamepad2,
  Keyboard,
  Mic2,
  Monitor,
  MonitorCog,
  Moon,
  NotebookPen,
  Power,
  Sun,
} from "lucide-react";
import "./GeneralSettings.css";
import type React from "react";
import {
  Field,
  SettingsSection,
  ShortcutInput,
  StatusBadge,
  Switch,
} from "../../../design/components";
import { useAppSettings } from "../../context/AppSettings";
import { useSettingsNavigation } from "../../context/SettingsNavigation";
import type { FeatureSettingsKey } from "../../settingsModel";
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
  {
    value: "system",
    label: "システム",
    description: "OSの外観設定に合わせる",
    icon: Monitor,
  },
] as const;

const featureOverview = [
  {
    id: "fileShelf",
    settingsKey: "fileShelf",
    label: "ファイルシェル",
    description: "ファイルやコピーした内容を一時保存",
    icon: Archive,
  },
  {
    id: "quickCapture",
    settingsKey: "quickCapture",
    label: "クイックキャプチャー",
    description: "思いつきをすぐに下書き保存",
    icon: NotebookPen,
  },
  {
    id: "gameLauncher",
    settingsKey: "gameLauncher",
    label: "ゲームランチャー",
    description: "インストール済みゲームをすばやく起動",
    icon: Gamepad2,
  },
  {
    id: "clock",
    settingsKey: "clock",
    label: "時計オーバーレイ",
    description: "必要なときだけ時刻を表示",
    icon: Clock3,
  },
  {
    id: "calendar",
    settingsKey: "calendar",
    label: "カレンダー",
    description: "予定をオーバーレイですぐ確認",
    icon: CalendarDays,
  },
  {
    id: "voiceToText",
    settingsKey: "voiceToText",
    label: "音声入力",
    description: "音声ファイルをテキストに変換",
    icon: Mic2,
  },
] as const satisfies ReadonlyArray<{
  id: Exclude<FeatureSettingsKey, "general">;
  settingsKey: FeatureSettingsKey;
  label: string;
  description: string;
  icon: typeof Archive;
}>;

export const GeneralSettings: React.FC = () => {
  const { settings, updateSettings, shortcutErrors } = useAppSettings();
  const { setActiveTab } = useSettingsNavigation();

  if (!settings) return null;

  const enabledFeatureCount = featureOverview.filter(
    ({ settingsKey }) => settings[settingsKey].enabled,
  ).length;
  const featureCountLabel = `${enabledFeatureCount} / ${featureOverview.length} 有効`;
  const featureCountTone =
    enabledFeatureCount === 0
      ? "disabled"
      : enabledFeatureCount === featureOverview.length
        ? "enabled"
        : "info";

  return (
    <SettingsSection
      title="一般設定"
      description="mint の外観と、設定画面をすばやく呼び出す方法を管理します。"
    >
      <div className="general-settings-layout">
        <section
          className="settings-group feature-overview"
          aria-labelledby="feature-overview-title"
        >
          <div className="settings-group__heading feature-overview__heading">
            <div>
              <h3 id="feature-overview-title">機能一覧</h3>
              <p>使いたい機能を選ぶと、その設定をすぐに開けます。</p>
            </div>
            <StatusBadge tone={featureCountTone}>
              {featureCountLabel}
            </StatusBadge>
          </div>
          <div className="feature-overview__grid">
            {featureOverview.map(
              ({ id, settingsKey, label, description, icon: Icon }) => {
                const isEnabled = settings[settingsKey].enabled;
                return (
                  <button
                    type="button"
                    className={`feature-overview__card ${isEnabled ? "is-enabled" : "is-disabled"}`}
                    key={id}
                    onClick={() => setActiveTab(id)}
                  >
                    <span className="feature-overview__icon" aria-hidden="true">
                      <Icon size={17} />
                    </span>
                    <span className="feature-overview__copy">
                      <strong>{label}</strong>
                      <small>{description}</small>
                    </span>
                    <span className="feature-overview__meta">
                      <StatusBadge tone={isEnabled ? "enabled" : "disabled"}>
                        {isEnabled ? "有効" : "無効"}
                      </StatusBadge>
                      <kbd>{settings[settingsKey].shortcut || "未設定"}</kbd>
                    </span>
                  </button>
                );
              },
            )}
          </div>
        </section>

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
                      id={value === "dark" ? "theme-dark-choice" : undefined}
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
