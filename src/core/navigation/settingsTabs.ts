import {
  Archive,
  CalendarDays,
  CalendarPlus,
  Clock3,
  Gamepad2,
  Mic2,
  Monitor,
  Moon,
  NotebookPen,
  SlidersHorizontal,
  Sun,
} from "lucide-react";
import React, { lazy } from "react";
import type { SidebarQuickAction } from "../../design/layout/Sidebar";

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
    searchItems: [
      {
        id: "file-shelf-shortcut",
        label: "起動ショートカットキー",
        description: "ファイルシェルの呼び出し",
        keywords: ["Alt+3", "キー"],
        targetId: "file-shelf-shortcut",
      },
      {
        id: "file-shelf-edge-handle",
        label: "ハンドルを常に表示する",
        description: "画面端のハンドル",
        keywords: ["画面端", "展開"],
        targetId: "file-shelf-edge-handle",
      },
      {
        id: "file-shelf-clipboard-history",
        label: "クリップボード履歴を保存する",
        description: "履歴の自動追加",
        keywords: ["履歴", "コピー", "保存"],
        targetId: "file-shelf-clipboard-history",
      },
      {
        id: "file-shelf-clipboard-limit",
        label: "履歴の保存件数",
        description: "クリップボード履歴の上限",
        keywords: ["履歴", "件数", "上限"],
        targetId: "file-shelf-clipboard-limit",
      },
    ],
    icon: React.createElement(Archive, { size: 18, "aria-hidden": true }),
  },
  {
    id: "quickCapture",
    label: "クイックキャプチャー",
    navigationLabel: "キャプチャー",
    description: "下書きとメモの呼び出し",
    keywords: ["メモ", "ノート", "下書き", "タグ", "添付"],
    searchItems: [
      {
        id: "quick-capture-shortcut",
        label: "起動ショートカットキー",
        description: "クイックキャプチャーの呼び出し",
        keywords: ["Alt+2", "キー"],
        targetId: "quick_capture_shortcut-input",
      },
    ],
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
    searchItems: [
      {
        id: "general-theme",
        label: "テーマ設定",
        description: "ダーク・ライト・システム",
        keywords: ["テーマ", "ダーク", "ライト", "システム"],
        targetId: "theme-dark-choice",
      },
      {
        id: "settings-shortcut",
        label: "設定画面表示ショートカット",
        description: "設定画面のクイックアクセス",
        keywords: ["Ctrl+K", "Command+K", "キー"],
        targetId: "settings-shortcut-input",
      },
      {
        id: "general-autostart",
        label: "PC起動時に自動で起動する",
        description: "システム連携",
        keywords: ["自動起動", "スタートアップ"],
        targetId: "general-autostart-input",
      },
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
    searchItems: [
      {
        id: "game-launcher-shortcut",
        label: "起動ショートカットキー",
        description: "ゲームランチャーの呼び出し",
        keywords: ["Alt+1", "キー"],
        targetId: "game-launcher-shortcut",
      },
      {
        id: "game-launcher-sources",
        label: "対応ランチャーを再確認",
        description: "Steam・Epic Games・Riot Gamesの検出",
        keywords: ["Steam", "Epic", "Riot", "再確認"],
        targetId: "game-launcher-sources-refresh",
      },
    ],
    icon: React.createElement(Gamepad2, { size: 18, "aria-hidden": true }),
  },
  {
    id: "clock",
    label: "時計オーバーレイ",
    navigationLabel: "時計",
    description: "表示とスタイル",
    keywords: ["時刻", "日付", "秒", "フォント", "オーバーレイ"],
    searchItems: [
      {
        id: "clock-shortcut",
        label: "起動ショートカットキー",
        description: "時計オーバーレイの呼び出し",
        keywords: ["Alt+Left", "キー"],
        targetId: "clock-shortcut-input",
      },
      {
        id: "clock-display-mode",
        label: "表示モード",
        description: "デジタル・アナログ",
        keywords: ["デジタル", "アナログ", "文字盤"],
        targetId: "clock-display-mode-select",
      },
      {
        id: "clock-size",
        label: "時計のサイズ倍率",
        description: "表示サイズ",
        keywords: ["サイズ", "大きさ", "%"],
        targetId: "clock-size-percent-input",
      },
      {
        id: "clock-seconds",
        label: "秒数を表示する",
        description: "表示スタイル",
        keywords: ["秒", "秒数"],
        targetId: "clock-show-seconds-checkbox",
      },
    ],
    icon: React.createElement(Clock3, { size: 18, "aria-hidden": true }),
  },
  {
    id: "calendar",
    label: "カレンダー",
    description: "月表示と呼び出し操作",
    keywords: ["予定", "イベント", "Google Calendar", "月表示"],
    searchItems: [
      {
        id: "calendar-shortcut",
        label: "起動ショートカットキー",
        description: "カレンダーの呼び出し",
        keywords: ["Alt+Down", "キー"],
        targetId: "calendar-shortcut-input",
      },
      {
        id: "calendar-create-event-shortcut",
        label: "予定登録ショートカットキー",
        description: "予定入力画面へ直接移動",
        keywords: ["Alt+Up", "予定", "キー"],
        targetId: "calendar-create-event-shortcut-input",
      },
    ],
    icon: React.createElement(CalendarDays, { size: 18, "aria-hidden": true }),
  },
  {
    id: "voiceToText",
    label: "音声入力",
    description: "音声の文字起こし",
    keywords: ["文字起こし", "音声ファイル", "API", "Whisper", "言語"],
    searchItems: [
      {
        id: "voice-to-text-shortcut",
        label: "文字起こしショートカットキー",
        description: "音声入力画面の呼び出し",
        keywords: ["Alt+End", "キー"],
        targetId: "v2t-shortcut-input",
      },
      {
        id: "voice-to-text-api-key",
        label: "APIキー",
        description: "音声認識APIの認証情報",
        keywords: ["API", "認証", "キー", "OpenAI", "Groq"],
        targetId: "v2t-api-key-input",
      },
      {
        id: "voice-to-text-model",
        label: "モデル名",
        description: "音声認識モデル",
        keywords: ["Whisper", "モデル"],
        targetId: "v2t-model-input",
      },
      {
        id: "voice-to-text-language",
        label: "言語コード",
        description: "音声認識時の入力言語",
        keywords: ["Language", "ISO", "ja", "en"],
        targetId: "v2t-language-input",
      },
      {
        id: "voice-to-text-audio-file",
        label: "音声ファイルパス",
        description: "文字起こしするファイル",
        keywords: ["WAV", "MP3", "M4A", "FLAC", "音声"],
        targetId: "v2t-audio-file-input",
      },
    ],
    icon: React.createElement(Mic2, { size: 18, "aria-hidden": true }),
  },
] as const;

export const SETTINGS_QUICK_ACTIONS = [
  {
    id: "set-theme-dark",
    label: "ダークテーマにする",
    description: "目にやさしい暗色テーマへ変更",
    keywords: ["テーマ", "外観", "ダーク", "夜"],
    targetId: "themeDark",
    icon: React.createElement(Moon, { size: 16, "aria-hidden": true }),
  },
  {
    id: "set-theme-light",
    label: "ライトテーマにする",
    description: "明るく見やすいテーマへ変更",
    keywords: ["テーマ", "外観", "ライト", "明るい"],
    targetId: "themeLight",
    icon: React.createElement(Sun, { size: 16, "aria-hidden": true }),
  },
  {
    id: "set-theme-system",
    label: "システムテーマにする",
    description: "OSの外観設定に合わせる",
    keywords: ["テーマ", "外観", "システム", "OS"],
    targetId: "themeSystem",
    icon: React.createElement(Monitor, { size: 16, "aria-hidden": true }),
  },
  {
    id: "open-clock",
    label: "時計を開く",
    description: "時計オーバーレイを表示",
    keywords: ["時計", "時刻", "オーバーレイ", "Alt+Left"],
    targetId: "clock",
    icon: React.createElement(Clock3, { size: 16, "aria-hidden": true }),
  },
  {
    id: "open-calendar",
    label: "カレンダーを開く",
    description: "予定と月表示を確認",
    keywords: ["カレンダー", "予定", "Google Calendar", "Alt+Down"],
    targetId: "calendar",
    icon: React.createElement(CalendarDays, {
      size: 16,
      "aria-hidden": true,
    }),
  },
  {
    id: "create-calendar-event",
    label: "今日の予定を追加",
    description: "今日の日付で予定入力を開始",
    keywords: ["予定", "イベント", "新規", "作成", "Alt+Up"],
    targetId: "calendarCreateEvent",
    icon: React.createElement(CalendarPlus, {
      size: 16,
      "aria-hidden": true,
    }),
  },
  {
    id: "open-game-launcher",
    label: "ゲームランチャーを開く",
    description: "インストール済みゲームを起動",
    keywords: ["ゲーム", "Steam", "Epic", "Riot", "Alt+1"],
    targetId: "gameLauncher",
    icon: React.createElement(Gamepad2, { size: 16, "aria-hidden": true }),
  },
  {
    id: "open-quick-capture",
    label: "クイックキャプチャーを開く",
    description: "メモと下書きをすばやく記録",
    keywords: ["メモ", "ノート", "下書き", "Alt+2"],
    targetId: "quickCapture",
    icon: React.createElement(NotebookPen, { size: 16, "aria-hidden": true }),
  },
  {
    id: "open-file-shelf",
    label: "ファイルシェルを開く",
    description: "ファイルとクリップボードを預ける",
    keywords: ["ファイル", "フォルダ", "クリップボード", "Alt+3"],
    targetId: "fileShelf",
    icon: React.createElement(Archive, { size: 16, "aria-hidden": true }),
  },
] as const satisfies readonly SidebarQuickAction[];

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
