import {
  AppWindow,
  History,
  Keyboard,
  PanelRightOpen,
  Plus,
  X,
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
  Select,
  SettingsSection,
  ShortcutInput,
  Switch,
} from "../../../design/components";
import { chooseIgnoredFileShelfApplication } from "../api";
import "./FileShelfSettings.css";

export const FileShelfSettings: React.FC = () => {
  const [ignoredApplicationError, setIgnoredApplicationError] = useState("");
  const {
    featureSettings: settings,
    handleChange,
    updateFeatureSettings,
    shortcutError,
  } = useFeatureSettings("fileShelf");

  if (!settings) return null;

  const addIgnoredApplication = async () => {
    setIgnoredApplicationError("");
    try {
      const application = await chooseIgnoredFileShelfApplication();
      if (!application) return;
      if (
        settings.ignoredApplications.some(
          (current) =>
            current.toLocaleLowerCase() === application.toLocaleLowerCase(),
        )
      ) {
        setIgnoredApplicationError(`${application} はすでに除外されています。`);
        return;
      }
      handleChange("ignoredApplications", [
        ...settings.ignoredApplications,
        application,
      ]);
    } catch (reason) {
      setIgnoredApplicationError(
        reason instanceof Error
          ? reason.message
          : "アプリを選択できませんでした。",
      );
    }
  };

  const removeIgnoredApplication = (application: string) => {
    setIgnoredApplicationError("");
    handleChange(
      "ignoredApplications",
      settings.ignoredApplications.filter((current) => current !== application),
    );
  };

  return (
    <SettingsSection
      title="ファイルシェル設定"
      description="ファイルやフォルダを画面端へ一時的に預け、別の場所へすばやく取り出します。"
    >
      <FeatureSettingsHeader
        switchId="file-shelf-enabled"
        label="ファイルシェル"
        enabled={settings.enabled}
        onChange={(event) => handleChange("enabled", event.target.checked)}
        onReset={() => updateFeatureSettings(defaultAppSettings.fileShelf)}
        ariaLabel="ファイルシェルを有効にする"
      />

      <div className="file-shelf-settings-grid">
        <section
          className="settings-group"
          aria-labelledby="file-shelf-shortcut-title"
        >
          <div className="settings-group__heading">
            <Keyboard size={18} aria-hidden="true" />
            <div>
              <h3 id="file-shelf-shortcut-title">呼び出し操作</h3>
              <p>どのアプリからでも棚を展開・折りたたみできます。</p>
            </div>
          </div>
          <Field
            id="file-shelf-shortcut"
            label="起動ショートカットキー"
            error={shortcutError}
            helpText="1回で展開・折りたたみ、すばやく2回でクリップボードを保存、800ms以上の長押しで最近外した項目を戻します。"
          >
            <ShortcutInput
              id="file-shelf-shortcut"
              invalid={Boolean(shortcutError)}
              value={settings.shortcut}
              onChange={(value) => handleChange("shortcut", value)}
              placeholderText="例: Alt+3"
            />
          </Field>
          <Field
            id="file-shelf-theme-color-picker"
            label="ファイルシェルのテーマカラー"
          >
            <ColorPresetPicker
              value={settings.themeColor}
              onChange={(value) => handleChange("themeColor", value)}
              ariaLabel="ファイルシェルのテーマカラー"
            />
          </Field>
        </section>

        <section
          className="settings-group"
          aria-labelledby="file-shelf-edge-title"
        >
          <div className="settings-group__heading">
            <PanelRightOpen size={18} aria-hidden="true" />
            <div>
              <h3 id="file-shelf-edge-title">画面端のハンドル</h3>
              <p>ファイルを近づけると棚が自動的に展開します。</p>
            </div>
          </div>
          <Field
            id="file-shelf-edge-handle"
            label="ハンドルを常に表示する"
            orientation="inline"
            helpText="無効にしてもショートカットから呼び出せます。"
          >
            <Switch
              id="file-shelf-edge-handle"
              checked={settings.edgeHandleEnabled}
              onChange={(event) =>
                handleChange("edgeHandleEnabled", event.target.checked)
              }
            />
          </Field>
          <Field id="file-shelf-edge" label="表示する側">
            <Select
              id="file-shelf-edge"
              value={settings.edge}
              disabled={!settings.edgeHandleEnabled}
              onChange={(event) =>
                handleChange("edge", event.target.value as "left" | "right")
              }
            >
              <option value="right">画面の右端</option>
              <option value="left">画面の左端</option>
            </Select>
          </Field>
          <Field id="file-shelf-vertical-position" label="縦の位置">
            <Select
              id="file-shelf-vertical-position"
              value={settings.verticalPosition}
              onChange={(event) =>
                handleChange(
                  "verticalPosition",
                  event.target.value as "top" | "center" | "bottom" | "cursor",
                )
              }
            >
              <option value="cursor">ポインター付近</option>
              <option value="top">上</option>
              <option value="center">中央</option>
              <option value="bottom">下</option>
            </Select>
          </Field>
          <p className="file-shelf-settings-note">
            ファイルの中身やパスは外部へ送信されません。貼り付けた画像だけMintのデータ領域へ保存します。
          </p>
        </section>

        <section
          className="settings-group file-shelf-settings-history"
          aria-labelledby="file-shelf-history-title"
        >
          <div className="settings-group__heading">
            <History size={18} aria-hidden="true" />
            <div>
              <h3 id="file-shelf-history-title">クリップボード履歴</h3>
              <p>有効にした後でコピーした文章とURLを自動で棚へ追加します。</p>
            </div>
          </div>
          <Field
            id="file-shelf-clipboard-history"
            label="クリップボード履歴を保存する"
            orientation="inline"
            helpText="初期状態は無効です。画像は必要なときにCtrl+Vで追加できます。"
          >
            <Switch
              id="file-shelf-clipboard-history"
              checked={settings.clipboardHistoryEnabled}
              onChange={(event) =>
                handleChange("clipboardHistoryEnabled", event.target.checked)
              }
            />
          </Field>
          <Field
            id="file-shelf-clipboard-limit"
            label="履歴の保存件数"
            helpText="同じ内容は重複させず、もう一度コピーすると先頭へ移動します。"
          >
            <Select
              id="file-shelf-clipboard-limit"
              value={String(settings.clipboardHistoryLimit)}
              disabled={!settings.clipboardHistoryEnabled}
              onChange={(event) =>
                handleChange(
                  "clipboardHistoryLimit",
                  Number(event.target.value),
                )
              }
            >
              <option value="10">10件</option>
              <option value="25">25件</option>
              <option value="50">50件</option>
            </Select>
          </Field>
          <p className="file-shelf-settings-note">
            履歴はこのPC内だけに保存されます。パスワードなどの機密情報をコピーする場合は無効にしてください。
          </p>
        </section>

        <section
          className="settings-group file-shelf-settings-ignored"
          aria-labelledby="file-shelf-ignored-title"
        >
          <div className="settings-group__heading">
            <AppWindow size={18} aria-hidden="true" />
            <div>
              <h3 id="file-shelf-ignored-title">除外するアプリ</h3>
              <p>
                指定したアプリでは、ドラッグ時の自動展開とクリップボード履歴の自動取得を止めます。
              </p>
            </div>
          </div>
          {settings.ignoredApplications.length ? (
            <ul className="file-shelf-settings-apps">
              {settings.ignoredApplications.map((application) => (
                <li className="file-shelf-settings-app" key={application}>
                  <AppWindow size={15} aria-hidden="true" />
                  <span>{application}</span>
                  <button
                    type="button"
                    onClick={() => removeIgnoredApplication(application)}
                    aria-label={`${application} を除外から外す`}
                    title="除外から外す"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="file-shelf-settings-apps-empty">
              除外しているアプリはありません。
            </p>
          )}
          <Button
            variant="ghost"
            className="file-shelf-settings-add-app"
            onClick={() => void addIgnoredApplication()}
          >
            <Plus size={15} aria-hidden="true" />
            アプリを追加
          </Button>
          {ignoredApplicationError && (
            <p className="file-shelf-settings-app-error" role="alert">
              {ignoredApplicationError}
            </p>
          )}
          <p className="file-shelf-settings-note">
            初期状態では主要なパスワード管理アプリを除外します。ショートカットからの手動表示や2連打での明示的な取り込みは引き続き使えます。
          </p>
        </section>
      </div>
    </SettingsSection>
  );
};
