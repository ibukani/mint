import type React from "react";
import type { SidebarQuickAction } from "../../design/layout/Sidebar";
import {
  getAvailableQuickActions,
  SETTINGS_QUICK_ACTIONS,
} from "../navigation/quickActions";
import { SETTINGS_TABS, type SettingsTabId } from "../navigation/settingsTabs";
import type { AppSettings, ThemeMode } from "../settingsModel";
import { isOverlayTarget, type OverlayTarget } from "../windowCommands";

export type MintActionCategory = "tab" | "setting" | "action";

export interface MintActionContext {
  updateSettings: (patch: Partial<AppSettings>) => void | Promise<void>;
  openOverlay: (target: OverlayTarget) => void | Promise<void>;
  openSettingsTab: (tab: SettingsTabId, targetId?: string) => Promise<void>;
  openCalendarEditor: () => void | Promise<void>;
}

export interface MintAction {
  key: string;
  category: MintActionCategory;
  title: string;
  description?: string;
  keywords: readonly string[];
  icon?: React.ReactNode;
  availability: (settings: AppSettings | null) => {
    available: boolean;
    reason?: string;
    disabledSettingsTarget?: { tabId: SettingsTabId; targetId?: string };
  };
  execute: (context: MintActionContext) => void | Promise<void>;
}

const executeQuickActionTarget = (
  targetId: string,
  context: MintActionContext,
): void | Promise<void> => {
  const themeTargets: Partial<Record<string, ThemeMode>> = {
    themeDark: "dark",
    themeLight: "light",
    themeSystem: "system",
  };
  const theme = themeTargets[targetId];
  if (theme) return context.updateSettings({ theme });
  if (targetId === "calendarCreateEvent") return context.openCalendarEditor();
  if (isOverlayTarget(targetId)) return context.openOverlay(targetId);
  throw new Error("利用できない操作です。");
};

export const MINT_ACTIONS: readonly MintAction[] = [
  ...SETTINGS_TABS.map((tab): MintAction => {
    const tabObj = tab as {
      description?: string;
      keywords?: readonly string[];
      icon?: React.ReactNode;
    };
    return {
      key: `tab:${tab.id}`,
      category: "tab",
      title: tab.label,
      description: tabObj.description,
      keywords: tabObj.keywords ?? [],
      icon: tabObj.icon,
      availability: () => ({ available: true }),
      execute: (context) => context.openSettingsTab(tab.id),
    };
  }),
  ...SETTINGS_TABS.flatMap((tab): MintAction[] => {
    const tabObj = tab as {
      icon?: React.ReactNode;
      searchItems?: readonly {
        id: string;
        label: string;
        description?: string;
        keywords?: readonly string[];
        targetId?: string;
      }[];
    };
    return (tabObj.searchItems ?? []).map(
      (item): MintAction => ({
        key: `setting:${tab.id}:${item.id}`,
        category: "setting",
        title: item.label,
        description: item.description,
        keywords: item.keywords ?? [],
        icon: tabObj.icon,
        availability: () => ({ available: true }),
        execute: (context) => context.openSettingsTab(tab.id, item.targetId),
      }),
    );
  }),
  ...SETTINGS_QUICK_ACTIONS.map(
    (action): MintAction => ({
      key: `action:${action.id}`,
      category: "action",
      title: action.label,
      description: action.description,
      keywords: action.keywords ?? [],
      icon: action.icon,
      availability: (settings) => {
        if (!settings) return { available: true };
        const candidate = getAvailableQuickActions(settings).find(
          (entry) => entry.id === action.id,
        ) as SidebarQuickAction<SettingsTabId> | undefined;
        if (!candidate?.disabled) return { available: true };
        return {
          available: false,
          reason: candidate.disabledReason ?? "この操作は現在利用できません。",
          disabledSettingsTarget: candidate.disabledSettingsTarget,
        };
      },
      execute: (context) => executeQuickActionTarget(action.targetId, context),
    }),
  ),
];

export const normalizeActionText = (text: string) =>
  text.toLocaleLowerCase("ja").replace(/\s+/g, "");

const matchScore = (action: MintAction, normalizedQuery: string): number => {
  const title = normalizeActionText(action.title);
  if (title === normalizedQuery) return 0;
  if (title.startsWith(normalizedQuery)) return 1;
  if (title.includes(normalizedQuery)) return 2;
  const keywords = action.keywords.map(normalizeActionText);
  if (keywords.some((keyword) => keyword.includes(normalizedQuery))) return 3;
  const description = normalizeActionText(action.description ?? "");
  if (description.includes(normalizedQuery)) return 3;
  return -1;
};

export interface MintActionSearchResult {
  normalizedQuery: string;
  recentResults: readonly MintAction[];
  results: readonly MintAction[];
}

export const searchMintActions = (
  actions: readonly MintAction[],
  query: string,
  recentKeys: readonly string[],
): MintActionSearchResult => {
  const normalizedQuery = normalizeActionText(query);
  const recentIndex = (action: MintAction) => {
    const index = recentKeys.indexOf(action.key);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  const recentResults = recentKeys
    .map((key) => actions.find((action) => action.key === key))
    .filter((action): action is MintAction => Boolean(action));

  if (normalizedQuery === "") {
    const rest = actions.filter(
      (action) => recentIndex(action) === Number.MAX_SAFE_INTEGER,
    );
    return {
      normalizedQuery,
      recentResults,
      results: [...recentResults, ...rest],
    };
  }

  const scored = actions
    .map((action) => ({ action, score: matchScore(action, normalizedQuery) }))
    .filter((entry) => entry.score >= 0);
  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return recentIndex(a.action) - recentIndex(b.action);
  });
  return {
    normalizedQuery,
    recentResults,
    results: scored.map((entry) => entry.action),
  };
};
