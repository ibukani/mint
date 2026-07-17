import { Archive, FileText, Keyboard, ShieldCheck } from "lucide-react";
import type React from "react";
import { defaultAppSettings } from "../../../core/defaultSettings";
import { useFeatureSettings } from "../../../core/hooks/useFeatureSettings";
import {
  ColorPresetPicker,
  FeatureSettingsHeader,
  Field,
  SettingsSection,
  ShortcutInput,
} from "../../../design/components";
import "./QuickCaptureSettings.css";

const captureSteps = [
  {
    title: "どこからでも呼び出す",
    description: "ショートカットで、いまの作業を止めずに開きます。",
    icon: Keyboard,
  },
  {
    title: "思いついたことを書く",
    description: "入力中の下書きは自動的に保存されます。",
    icon: FileText,
  },
  {
    title: "必要なものだけ残す",
    description: "メモに保存して、あとから検索・整理できます。",
    icon: Archive,
  },
] as const;

export const QuickCaptureSettings: React.FC = () => {
  const {
    featureSettings: settings,
    handleChange,
    updateFeatureSettings,
    shortcutError,
  } = useFeatureSettings("quickCapture");

  if (!settings) return null;

  return (
    <SettingsSection
      title="クイックキャプチャー設定"
      description="アプリを開かず、下書きやメモをすぐ呼び出します。"
    >
      <FeatureSettingsHeader
        switchId="quick-capture-enabled"
        label="クイックキャプチャー"
        enabled={settings.enabled}
        onChange={(event) => handleChange("enabled", event.target.checked)}
        onReset={() => updateFeatureSettings(defaultAppSettings.quickCapture)}
        ariaLabel="クイックキャプチャーを有効にする"
      />

      <div className="quick-capture-settings-grid">
        <section
          className="settings-group quick-capture-shortcut-card"
          aria-labelledby="quick-capture-shortcut-title"
        >
          <div className="settings-group__heading">
            <Keyboard size={18} aria-hidden="true" />
            <div>
              <h3 id="quick-capture-shortcut-title">呼び出し操作</h3>
              <p>どのアプリを使っていても、すぐに書き始められます。</p>
            </div>
          </div>
          <Field
            id="quick_capture-shortcut-input"
            label="起動ショートカットキー"
            error={shortcutError}
            helpText="入力欄を選択して、使いたいキーの組み合わせを押します。"
          >
            <ShortcutInput
              id="quick_capture-shortcut-input"
              invalid={Boolean(shortcutError)}
              value={settings.shortcut}
              onChange={(value) => handleChange("shortcut", value)}
              placeholderText="例: Alt+2"
            />
          </Field>
          <Field
            id="quick-capture-theme-color-picker"
            label="クイックキャプチャーのテーマカラー"
          >
            <ColorPresetPicker
              value={settings.themeColor}
              onChange={(value) => handleChange("themeColor", value)}
              ariaLabel="クイックキャプチャーのテーマカラー"
            />
          </Field>
          <div className="quick-capture-shortcut-summary">
            <kbd>{settings.shortcut || "未設定"}</kbd>
            <span>でクイックキャプチャーを表示</span>
          </div>
        </section>

        <section
          className="settings-group quick-capture-flow-card"
          aria-labelledby="quick-capture-flow-title"
        >
          <div className="settings-group__heading">
            <FileText size={18} aria-hidden="true" />
            <div>
              <h3 id="quick-capture-flow-title">キャプチャーの流れ</h3>
              <p>考えを逃さず、あとで使えるメモにします。</p>
            </div>
          </div>
          <ol className="quick-capture-flow">
            {captureSteps.map(({ title, description, icon: Icon }, index) => (
              <li className="quick-capture-flow__step" key={title}>
                <span className="quick-capture-flow__marker">{index + 1}</span>
                <span className="quick-capture-flow__icon" aria-hidden="true">
                  <Icon size={16} />
                </span>
                <span className="quick-capture-flow__copy">
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
              </li>
            ))}
          </ol>
          <div className="quick-capture-local-note">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>
              <strong>このPCにローカル保存</strong>
              <small>メモの内容は自動で外部へ送信されません。</small>
            </span>
          </div>
        </section>
      </div>
    </SettingsSection>
  );
};
