import {
  Archive,
  CalendarDays,
  CalendarPlus,
  Clock3,
  Gamepad2,
  Monitor,
  Moon,
  NotebookPen,
  Sun,
} from "lucide-react";
import React from "react";
import type { SidebarQuickAction } from "../../design/layout/Sidebar";
import type { AppSettings } from "../settingsModel";
import type { SettingsTabId } from "./settingsTabs";

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
    description: "ファイルやフォルダの一時置き場",
    keywords: ["ファイル", "フォルダ", "クリップボード", "Alt+3"],
    targetId: "fileShelf",
    icon: React.createElement(Archive, { size: 16, "aria-hidden": true }),
  },
] as const satisfies readonly SidebarQuickAction[];

export type QuickActionTarget =
  (typeof SETTINGS_QUICK_ACTIONS)[number]["targetId"];

type OverlayFeatureSettingsKey =
  | "clock"
  | "calendar"
  | "gameLauncher"
  | "quickCapture"
  | "fileShelf";

type QuickActionAvailability = {
  settingsKey: OverlayFeatureSettingsKey;
  tabId: SettingsTabId;
  targetId: string;
  label: string;
};

const quickActionAvailability: Partial<
  Record<QuickActionTarget, QuickActionAvailability>
> = {
  clock: {
    settingsKey: "clock",
    tabId: "clock",
    targetId: "clock-enabled-checkbox",
    label: "時計オーバーレイ",
  },
  calendar: {
    settingsKey: "calendar",
    tabId: "calendar",
    targetId: "calendar-enabled-checkbox",
    label: "カレンダー",
  },
  calendarCreateEvent: {
    settingsKey: "calendar",
    tabId: "calendar",
    targetId: "calendar-enabled-checkbox",
    label: "カレンダー",
  },
  gameLauncher: {
    settingsKey: "gameLauncher",
    tabId: "gameLauncher",
    targetId: "game-launcher-enabled",
    label: "ゲームランチャー",
  },
  quickCapture: {
    settingsKey: "quickCapture",
    tabId: "quickCapture",
    targetId: "quick-capture-enabled",
    label: "クイックキャプチャー",
  },
  fileShelf: {
    settingsKey: "fileShelf",
    tabId: "fileShelf",
    targetId: "file-shelf-enabled",
    label: "ファイルシェル",
  },
};

export const getAvailableQuickActions = (settings: AppSettings | null) => {
  if (!settings) return SETTINGS_QUICK_ACTIONS;

  return SETTINGS_QUICK_ACTIONS.map((action) => {
    const availability = quickActionAvailability[action.targetId];
    if (!availability || settings[availability.settingsKey].enabled) {
      return action;
    }

    return {
      ...action,
      disabled: true,
      disabledReason: `${availability.label}が無効です。詳細設定で有効にしてください。`,
      disabledSettingsTarget: {
        tabId: availability.tabId,
        targetId: availability.targetId,
      },
    };
  });
};
