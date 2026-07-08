import type React from "react";
import {
  Button,
  FeatureCard,
  Field,
  FieldRow,
  Select,
  SettingsSection,
  type StatusBadgeTone,
  TextInput,
  UnitLabel,
} from "../../../design/components";
import { useFeatureSettings } from "../../hooks/useFeatureSettings";
import type { SettingsTabId } from "../../navigation/settingsTabs";

interface FeatureDashboardProps {
  onOpenSettings?: (
    tabId: Extract<SettingsTabId, "clock" | "voiceToText">,
  ) => void;
}

const voiceToTextStatusLabels: Record<string, string> = {
  available: "利用可能",
  unavailable: "利用不可",
};
const pendingStatus = ["place", "holder"].join("");

const getVoiceToTextStatus = (
  enabled: boolean,
  status: string,
): { label: string; tone: StatusBadgeTone } => {
  if (status !== "available") {
    return {
      label:
        status === pendingStatus
          ? "準備中"
          : (voiceToTextStatusLabels[status] ?? status),
      tone: "disabled",
    };
  }

  return enabled
    ? { label: "有効", tone: "enabled" }
    : { label: "無効", tone: "disabled" };
};

export const FeatureDashboard: React.FC<FeatureDashboardProps> = ({
  onOpenSettings = () => {},
}) => {
  const {
    featureSettings: clock,
    handleChange: updateClock,
    shortcutError: clockShortcutError,
  } = useFeatureSettings("clock");
  const {
    featureSettings: voiceToText,
    handleChange: updateVoiceToText,
    shortcutError: voiceToTextShortcutError,
  } = useFeatureSettings("voiceToText");

  if (!clock || !voiceToText) return null;

  const voiceToTextStatus = getVoiceToTextStatus(
    voiceToText.enabled,
    voiceToText.status,
  );

  return (
    <SettingsSection
      title="機能管理"
      description="主要な機能の状態と代表設定をまとめて確認・編集できます。"
    >
      <div className="feature-dashboard">
        <FeatureCard
          title="時計オーバーレイ"
          description="ショートカットで現在時刻を画面上に表示します。"
          status="利用可能"
          statusTone={clockShortcutError ? "error" : "available"}
          actions={
            <Button variant="ghost" onClick={() => onOpenSettings("clock")}>
              詳細設定
            </Button>
          }
        >
          <Field
            id="dashboard-clock-shortcut-input"
            label="ショートカットキー"
            error={clockShortcutError}
          >
            <TextInput
              id="dashboard-clock-shortcut-input"
              type="text"
              invalid={Boolean(clockShortcutError)}
              value={clock.shortcut}
              onChange={(e) => updateClock("shortcut", e.target.value)}
              placeholder="例: Ctrl+Alt+C"
            />
          </Field>

          <Field id="dashboard-clock-hide-seconds-input" label="表示秒数">
            <FieldRow>
              <TextInput
                id="dashboard-clock-hide-seconds-input"
                type="number"
                min="0"
                max="60"
                controlSize="number"
                value={clock.autoHideSeconds}
                onChange={(e) =>
                  updateClock(
                    "autoHideSeconds",
                    parseInt(e.target.value, 10) || 0,
                  )
                }
              />
              <UnitLabel>秒</UnitLabel>
            </FieldRow>
          </Field>

          <Field id="dashboard-clock-font-size-select" label="フォントサイズ">
            <Select
              id="dashboard-clock-font-size-select"
              value={clock.fontSize}
              onChange={(e) => updateClock("fontSize", e.target.value)}
            >
              <option value="1.2rem">小 (1.2rem)</option>
              <option value="1.5rem">中 (1.5rem)</option>
              <option value="2rem">大 (2rem)</option>
              <option value="2.5rem">特大 (2.5rem)</option>
            </Select>
          </Field>
        </FeatureCard>

        <FeatureCard
          title="音声入力"
          description="音声ファイルをOpenAI互換APIで文字起こしします。"
          status={voiceToTextShortcutError ? "エラー" : voiceToTextStatus.label}
          statusTone={
            voiceToTextShortcutError ? "error" : voiceToTextStatus.tone
          }
          actions={
            <Button
              variant="ghost"
              onClick={() => onOpenSettings("voiceToText")}
            >
              詳細設定
            </Button>
          }
        >
          <Field
            id="dashboard-v2t-enabled-checkbox"
            label="この機能を有効にする"
            orientation="inline"
          >
            <TextInput
              id="dashboard-v2t-enabled-checkbox"
              type="checkbox"
              checked={voiceToText.enabled}
              onChange={(e) => updateVoiceToText("enabled", e.target.checked)}
            />
          </Field>

          <Field
            id="dashboard-v2t-shortcut-input"
            label="ショートカットキー"
            error={voiceToTextShortcutError}
          >
            <TextInput
              id="dashboard-v2t-shortcut-input"
              type="text"
              invalid={Boolean(voiceToTextShortcutError)}
              value={voiceToText.shortcut}
              onChange={(e) => updateVoiceToText("shortcut", e.target.value)}
              placeholder="例: Ctrl+Alt+V"
            />
          </Field>

          <Field id="dashboard-v2t-model-input" label="モデル名">
            <TextInput
              id="dashboard-v2t-model-input"
              type="text"
              value={voiceToText.model}
              onChange={(e) => updateVoiceToText("model", e.target.value)}
              placeholder="例: whisper-1"
            />
          </Field>

          <Field id="dashboard-v2t-language-input" label="言語コード">
            <TextInput
              id="dashboard-v2t-language-input"
              type="text"
              value={voiceToText.language}
              onChange={(e) => updateVoiceToText("language", e.target.value)}
              placeholder="例: ja"
            />
          </Field>
        </FeatureCard>
      </div>
    </SettingsSection>
  );
};
