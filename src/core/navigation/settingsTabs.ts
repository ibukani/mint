import {
  Archive,
  CalendarDays,
  Clock3,
  Gamepad2,
  Mic2,
  NotebookPen,
  SlidersHorizontal,
} from "lucide-react";
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

const CalendarSettings = lazy(() =>
  import("../../features/calendar/components/CalendarSettings").then((m) => ({
    default: m.CalendarSettings,
  })),
);

const GameLauncherSettings = lazy(() =>
  import("../../features/game_launcher/components/GameLauncherSettings").then(
    (m) => ({ default: m.GameLauncherSettings }),
  ),
);

const QuickCaptureSettings = lazy(() =>
  import("../../features/quick_capture/components/QuickCaptureSettings").then(
    (m) => ({ default: m.QuickCaptureSettings }),
  ),
);

const FileShelfSettings = lazy(() =>
  import("../../features/file_shelf/components/FileShelfSettings").then(
    (m) => ({ default: m.FileShelfSettings }),
  ),
);

export const SETTINGS_TABS = [
  {
    id: "fileShelf",
    label: "ファイルシェル",
    navigationLabel: "シェルフ",
    description: "ファイルの一時置き場",
    keywords: ["ファイル", "フォルダ", "クリップボード", "履歴", "Alt+3"],
    icon: React.createElement(Archive, { size: 18, "aria-hidden": true }),
  },
  {
    id: "quickCapture",
    label: "クイックキャプチャー",
    navigationLabel: "キャプチャー",
    description: "下書きとメモの呼び出し",
    keywords: ["メモ", "ノート", "下書き", "タグ", "添付"],
    icon: React.createElement(NotebookPen, { size: 18, "aria-hidden": true }),
  },
  {
    id: "general",
    label: "一般設定",
    description: "テーマと起動操作",
    keywords: [
      "テーマ",
      "ダーク",
      "ライト",
      "自動起動",
      "ショートカット",
      "アップデート",
    ],
    icon: React.createElement(SlidersHorizontal, {
      size: 18,
      "aria-hidden": true,
    }),
  },
  {
    id: "gameLauncher",
    label: "ゲームランチャー",
    description: "ゲームの検出と起動",
    keywords: ["Steam", "Epic", "Riot", "ストア", "ゲーム"],
    icon: React.createElement(Gamepad2, { size: 18, "aria-hidden": true }),
  },
  {
    id: "clock",
    label: "時計オーバーレイ",
    navigationLabel: "時計",
    description: "表示とスタイル",
    keywords: ["時刻", "日付", "秒", "フォント", "オーバーレイ"],
    icon: React.createElement(Clock3, { size: 18, "aria-hidden": true }),
  },
  {
    id: "calendar",
    label: "カレンダー",
    description: "月表示と呼び出し操作",
    keywords: ["予定", "イベント", "Google Calendar", "月表示"],
    icon: React.createElement(CalendarDays, { size: 18, "aria-hidden": true }),
  },
  {
    id: "voiceToText",
    label: "音声入力",
    description: "音声の文字起こし",
    keywords: ["文字起こし", "音声ファイル", "API", "Whisper", "言語"],
    icon: React.createElement(Mic2, { size: 18, "aria-hidden": true }),
  },
] as const;

export type SettingsTabId = (typeof SETTINGS_TABS)[number]["id"];

export const SETTINGS_TAB_COMPONENTS: Record<
  SettingsTabId,
  React.LazyExoticComponent<React.FC>
> = {
  fileShelf: FileShelfSettings,
  quickCapture: QuickCaptureSettings,
  gameLauncher: GameLauncherSettings,
  calendar: CalendarSettings,
  general: GeneralSettings,
  clock: ClockSettings,
  voiceToText: VoiceToTextSettings,
};
