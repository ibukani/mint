import { Clock3, Mic2, SlidersHorizontal } from "lucide-react";
import React from "react";
import { ClockSettings } from "../../features/clock/components/ClockSettings";
import { VoiceToTextSettings } from "../../features/v2t/components/VoiceToTextSettings";
import { GeneralSettings } from "../components/settings/GeneralSettings";

export const SETTINGS_TABS = [
  {
    id: "general",
    label: "一般設定",
    description: "テーマと起動操作",
    icon: React.createElement(SlidersHorizontal, {
      size: 18,
      "aria-hidden": true,
    }),
  },
  {
    id: "clock",
    label: "時計オーバーレイ",
    description: "表示とスタイル",
    icon: React.createElement(Clock3, { size: 18, "aria-hidden": true }),
  },
  {
    id: "voiceToText",
    label: "音声入力",
    description: "音声の文字起こし",
    icon: React.createElement(Mic2, { size: 18, "aria-hidden": true }),
  },
] as const;

export type SettingsTabId = (typeof SETTINGS_TABS)[number]["id"];

export const SETTINGS_TAB_COMPONENTS: Record<SettingsTabId, React.FC> = {
  general: GeneralSettings,
  clock: ClockSettings,
  voiceToText: VoiceToTextSettings,
};
