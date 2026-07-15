import type React from "react";
import {
  FeatureSettingsHeader,
  SettingsSection,
} from "../../../design/components";
import { useVoiceToTextController } from "../hooks/useVoiceToTextController";
import "./VoiceToTextSettings.css";
import { TranscriptionWorkbench } from "./TranscriptionWorkbench";
import { VoiceToTextConnectionSettings } from "./VoiceToTextConnectionSettings";

export const VoiceToTextSettings: React.FC = () => {
  const controller = useVoiceToTextController();
  if (!controller) return null;

  const {
    voiceToText,
    handleChange,
    clearTranscriptionOutput,
    resetVoiceToTextSettings,
  } = controller;

  return (
    <SettingsSection
      title="音声入力設定"
      description="音声認識APIへの接続と、音声ファイルの文字起こしを管理します。"
    >
      <FeatureSettingsHeader
        switchId="v2t-enabled-checkbox"
        label="音声入力"
        enabled={voiceToText.enabled}
        onChange={(event) => {
          clearTranscriptionOutput();
          handleChange("enabled", event.target.checked);
        }}
        onReset={resetVoiceToTextSettings}
        ariaLabel="音声入力を有効にする"
      />

      <div className="v2t-workspace">
        <VoiceToTextConnectionSettings controller={controller} />
        <TranscriptionWorkbench controller={controller} />
      </div>
    </SettingsSection>
  );
};
