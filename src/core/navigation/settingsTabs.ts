import {
  CalendarDays,
  Clock3,
  Command,
  Gamepad2,
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

const MintPaletteSettings = lazy(() =>
  import("../../features/mint_palette/components/MintPaletteSettings").then(
    (m) => ({ default: m.MintPaletteSettings }),
  ),
);

export const SETTINGS_TABS = [
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
    id: "mintPalette",
    label: "MintPalette 設定",
    navigationLabel: "Mint Palette",
    description: "グローバルコマンドパレット",
    keywords: ["コマンドパレット", "検索", "Ctrl+K", "ランチャー", "起動"],
    searchItems: [
      {
        id: "mint-palette-shortcut",
        label: "起動ショートカットキー",
        description: "MintPaletteの呼び出し",
        keywords: ["Ctrl+Alt+M", "キー", "コマンドパレット"],
        targetId: "mint-palette-shortcut-input",
      },
    ],
    icon: React.createElement(Command, { size: 18, "aria-hidden": true }),
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
  // scaffold:settings-tabs
] as const;

export type SettingsTabId = (typeof SETTINGS_TABS)[number]["id"];

export const SETTINGS_TAB_COMPONENTS: Record<
  SettingsTabId,
  React.LazyExoticComponent<React.FC>
> = {
  mintPalette: MintPaletteSettings,
  gameLauncher: GameLauncherSettings,
  calendar: CalendarSettings,
  general: GeneralSettings,
  clock: ClockSettings,
};
