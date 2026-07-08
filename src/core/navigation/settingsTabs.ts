import type React from "react";
import { ClockSettings } from "../../features/clock/components/ClockSettings";
import { VoiceToTextSettings } from "../../features/v2t/components/VoiceToTextSettings";
import { FeatureDashboard } from "../components/dashboard/FeatureDashboard";
import { GeneralSettings } from "../components/settings/GeneralSettings";

export const SETTINGS_TABS = [
  { id: "general", label: "一般設定" },
  { id: "dashboard", label: "機能管理" },
  { id: "clock", label: "時計オーバーレイ" },
  { id: "voiceToText", label: "音声入力" },
] as const;

export type SettingsTabId = (typeof SETTINGS_TABS)[number]["id"];

export const SETTINGS_TAB_COMPONENTS: Record<SettingsTabId, React.FC> = {
  general: GeneralSettings,
  dashboard: FeatureDashboard,
  clock: ClockSettings,
  voiceToText: VoiceToTextSettings,
};
