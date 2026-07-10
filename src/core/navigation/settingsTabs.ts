import { Clock3, Mic2, SlidersHorizontal } from "lucide-react";
import React, { lazy } from "react";

const GeneralSettings = lazy(() =>
  import("../components/settings/GeneralSettings").then((m) => ({
    default: m.GeneralSettings,
  })),
);

const ClockSettings = lazy(() =>
  import("../../features/clock/components/ClockSettings").then((m) => ({
    default: m.ClockSettings,
  })),
);

const VoiceToTextSettings = lazy(() =>
  import("../../features/v2t/components/VoiceToTextSettings").then((m) => ({
    default: m.VoiceToTextSettings,
  })),
);

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

export const SETTINGS_TAB_COMPONENTS: Record<
  SettingsTabId,
  React.LazyExoticComponent<React.FC>
> = {
  general: GeneralSettings,
  clock: ClockSettings,
  voiceToText: VoiceToTextSettings,
};
