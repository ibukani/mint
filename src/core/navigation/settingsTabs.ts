import React from "react";
import { ClockSettings } from "../../features/clock/components/ClockSettings";
import { VoiceToTextSettings } from "../../features/v2t/components/VoiceToTextSettings";
import { GeneralSettings } from "../components/settings/GeneralSettings";

export const SETTINGS_TABS = [
  {
    id: "general",
    label: "一般設定",
    icon: React.createElement(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        width: "16",
        height: "16",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": "true",
      },
      React.createElement("circle", { cx: "12", cy: "12", r: "3" }),
      React.createElement("path", {
        d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l-.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
      }),
    ),
  },
  {
    id: "clock",
    label: "時計オーバーレイ",
    icon: React.createElement(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        width: "16",
        height: "16",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": "true",
      },
      React.createElement("circle", { cx: "12", cy: "12", r: "10" }),
      React.createElement("polyline", { points: "12 6 12 12 16 14" }),
    ),
  },
  {
    id: "voiceToText",
    label: "音声入力",
    icon: React.createElement(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        width: "16",
        height: "16",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": "true",
      },
      React.createElement("path", {
        d: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z",
      }),
      React.createElement("path", { d: "M19 10v1a7 7 0 0 1-14 0v-1" }),
      React.createElement("line", { x1: "12", x2: "12", y1: "19", y2: "22" }),
    ),
  },
] as const;

export type SettingsTabId = (typeof SETTINGS_TABS)[number]["id"];

export const SETTINGS_TAB_COMPONENTS: Record<SettingsTabId, React.FC> = {
  general: GeneralSettings,
  clock: ClockSettings,
  voiceToText: VoiceToTextSettings,
};
