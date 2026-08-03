import {
  Archive,
  DatabaseBackup,
  FileText,
  Keyboard,
  Palette,
  ShieldCheck,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { defaultAppSettings } from "../../../core/defaultSettings";
import { useFeatureSettings } from "../../../core/hooks/useFeatureSettings";
import {
  Button,
  ColorPresetPicker,
  FeatureSettingsHeader,
  Field,
  FieldRow,
  Select,
  SettingsSection,
  ShortcutInput,
  Switch,
  TextInput,
} from "../../../design/components";
import {
  chooseQuickCaptureBackupForOpen,
  chooseQuickCaptureBackupForSave,
  exportQuickCaptureBackup,
  importQuickCaptureBackup,
} from "../api";
import "./QuickCaptureSettings.css";

const captureSteps = [
  {
    title: "どこからでも呼び出す",
    description: "ショートカットで、いまの作業を止めずに開きます。",
    icon: Keyboard,
  },
  {
    title: "思いついたことを書く",
    description: "入力した内容は通常のメモとして自動的に保存されます。",
    icon: FileText,
  },
  {
    title: "必要なものだけ残す",
    description: "あとから検索・整理できるメモとして残ります。",
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
  const [dataBusy, setDataBusy] = useState(false);
  const [dataFeedback, setDataFeedback] = useState<string | null>(null);

  if (!settings) return null;

  const runBackup = async (mode: "export" | "import") => {
    setDataFeedback(null);
    const path =
      mode === "export"
        ? await chooseQuickCaptureBackupForSave()
        : await chooseQuickCaptureBackupForOpen();
    if (
      !path ||
      (mode === "import" &&
        !window.confirm("現在のメモを選択したバックアップで置き換えますか？"))
    ) {
      return;
    }
    setDataBusy(true);
    try {
      if (mode === "export") {
        await exportQuickCaptureBackup(path);
        setDataFeedback("バックアップを書き出しました。");
      } else {
        await importQuickCaptureBackup(path);
        setDataFeedback(
          "バックアップを復元しました。次回クイックキャプチャーを開くと反映されます。",
        );
      }
    } catch (reason) {
      setDataFeedback(
        reason instanceof Error
          ? reason.message
          : "バックアップ操作に失敗しました。",
      );
    } finally {
      setDataBusy(false);
    }
  };

  return (
    <SettingsSection
      title="クイックキャプチャー設定"
      description="アプリを開かず、メモをすぐ呼び出して書き始めます。"
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
        <div className="quick-capture-settings-column">
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
            <div className="quick-capture-shortcut-summary">
              <kbd>{settings.shortcut || "未設定"}</kbd>
              <span>でクイックキャプチャーを表示</span>
            </div>
          </section>

          <section
            className="settings-group"
            aria-labelledby="quick-capture-editor-title"
          >
            <div className="settings-group__heading">
              <FileText size={18} aria-hidden="true" />
              <div>
                <h3 id="quick-capture-editor-title">エディター</h3>
                <p>本文の読みやすさと入力感を調整します。</p>
              </div>
            </div>
            <Field id="quick-capture-font-family" label="フォントファミリー">
              <Select
                id="quick-capture-font-family"
                value={settings.fontFamily}
                onChange={(event) =>
                  handleChange("fontFamily", event.target.value)
                }
              >
                <option value="ui-monospace">等幅（推奨）</option>
                <option value="system-ui">システム標準</option>
                <option value="serif">セリフ体</option>
              </Select>
            </Field>
            <FieldRow>
              <Field id="quick-capture-font-size" label="文字サイズ">
                <TextInput
                  id="quick-capture-font-size"
                  type="number"
                  min="12"
                  max="24"
                  controlSize="number"
                  value={settings.fontSize}
                  onChange={(event) =>
                    handleChange(
                      "fontSize",
                      Math.min(
                        24,
                        Math.max(12, Number(event.target.value) || 16),
                      ),
                    )
                  }
                />
              </Field>
              <Field id="quick-capture-line-height" label="行間">
                <TextInput
                  id="quick-capture-line-height"
                  type="number"
                  min="1.2"
                  max="2.4"
                  step="0.05"
                  controlSize="number"
                  value={settings.lineHeight}
                  onChange={(event) =>
                    handleChange(
                      "lineHeight",
                      Math.min(
                        2.4,
                        Math.max(1.2, Number(event.target.value) || 1.75),
                      ),
                    )
                  }
                />
              </Field>
              <Field id="quick-capture-tab-width" label="タブ幅">
                <TextInput
                  id="quick-capture-tab-width"
                  type="number"
                  min="2"
                  max="8"
                  controlSize="number"
                  value={settings.tabWidth}
                  onChange={(event) =>
                    handleChange(
                      "tabWidth",
                      Math.min(8, Math.max(2, Number(event.target.value) || 2)),
                    )
                  }
                />
              </Field>
            </FieldRow>
            <div className="quick-capture-settings-toggle">
              <span>行番号を表示</span>
              <Switch
                id="quick-capture-show-line-numbers"
                aria-label="行番号を表示"
                checked={settings.showLineNumbers}
                onChange={(event) =>
                  handleChange("showLineNumbers", event.target.checked)
                }
              />
            </div>
            <div className="quick-capture-settings-toggle">
              <span>長い行を折り返す</span>
              <Switch
                id="quick-capture-word-wrap"
                aria-label="長い行を折り返す"
                checked={settings.wordWrap}
                onChange={(event) =>
                  handleChange("wordWrap", event.target.checked)
                }
              />
            </div>
            <div className="quick-capture-settings-toggle">
              <span>スペルチェック</span>
              <Switch
                id="quick-capture-spell-check"
                aria-label="スペルチェック"
                checked={settings.spellCheck}
                onChange={(event) =>
                  handleChange("spellCheck", event.target.checked)
                }
              />
            </div>
            <div className="quick-capture-settings-toggle">
              <span>現在行を強調</span>
              <Switch
                id="quick-capture-highlight-current-line"
                aria-label="現在行を強調"
                checked={settings.highlightCurrentLine}
                onChange={(event) =>
                  handleChange("highlightCurrentLine", event.target.checked)
                }
              />
            </div>
          </section>

          <section
            className="settings-group"
            aria-labelledby="quick-capture-window-title"
          >
            <div className="settings-group__heading">
              <Keyboard size={18} aria-hidden="true" />
              <div>
                <h3 id="quick-capture-window-title">ウィンドウ</h3>
                <p>作業環境に合わせた表示方法を選びます。</p>
              </div>
            </div>
            <div className="quick-capture-settings-toggle">
              <span>常に手前に表示</span>
              <Switch
                id="quick-capture-always-on-top"
                aria-label="常に手前に表示"
                checked={settings.alwaysOnTop}
                onChange={(event) =>
                  handleChange("alwaysOnTop", event.target.checked)
                }
              />
            </div>
          </section>

          <section
            className="settings-group"
            aria-labelledby="quick-capture-style-title"
          >
            <div className="settings-group__heading">
              <Palette size={18} aria-hidden="true" />
              <div>
                <h3 id="quick-capture-style-title">表示スタイル</h3>
                <p>アクセントカラーの設定</p>
              </div>
            </div>
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
          </section>
        </div>

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

      <section
        className="settings-group"
        aria-labelledby="quick-capture-data-title"
      >
        <div className="settings-group__heading">
          <DatabaseBackup size={18} aria-hidden="true" />
          <div>
            <h3 id="quick-capture-data-title">データ管理</h3>
            <p>メモと添付ファイルをまとめてバックアップします。</p>
          </div>
        </div>
        <div className="quick-capture-data-actions">
          <Button
            variant="primary"
            disabled={dataBusy}
            onClick={() => void runBackup("export")}
          >
            バックアップを書き出す
          </Button>
          <Button
            variant="ghost"
            disabled={dataBusy}
            onClick={() => void runBackup("import")}
          >
            バックアップから復元
          </Button>
        </div>
        {dataFeedback && (
          <p className="quick-capture-data-feedback" role="status">
            {dataFeedback}
          </p>
        )}
      </section>
    </SettingsSection>
  );
};
