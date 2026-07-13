import { Keyboard, PanelRightOpen } from "lucide-react";
import type React from "react";
import { defaultAppSettings } from "../../../core/defaultSettings";
import { useFeatureSettings } from "../../../core/hooks/useFeatureSettings";
import {
  FeatureSettingsHeader,
  Field,
  Select,
  SettingsSection,
  ShortcutInput,
  Switch,
} from "../../../design/components";
import "./FileShelfSettings.css";

export const FileShelfSettings: React.FC = () => {
  const {
    featureSettings: settings,
    handleChange,
    updateFeatureSettings,
    shortcutError,
  } = useFeatureSettings("fileShelf");

  if (!settings) return null;

  return (
    <SettingsSection
      title="ファイルシェル"
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
            helpText="同じキーをもう一度押すか、Escで折りたたみます。"
          >
            <ShortcutInput
              id="file-shelf-shortcut"
              invalid={Boolean(shortcutError)}
              value={settings.shortcut}
              onChange={(value) => handleChange("shortcut", value)}
              placeholderText="例: Alt+3"
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
          <p className="file-shelf-settings-note">
            ファイルの中身やパスは外部へ送信されません。貼り付けた画像だけMintのデータ領域へ保存します。
          </p>
        </section>
      </div>
    </SettingsSection>
  );
};
