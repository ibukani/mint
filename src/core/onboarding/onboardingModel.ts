import type {
  AppSettings,
  FeatureSettingsKey,
  ThemeMode,
} from "../settingsModel";
import type { OverlayTarget } from "../windowCommands";

/// Current version of the onboarding flow. Bump when the setup content
/// changes materially so returning users can be shown only the new parts.
/// Must stay in sync with `ONBOARDING_VERSION` in src-tauri/src/core/settings_model.rs.
export const ONBOARDING_VERSION = 1;

export interface OnboardingFeatureMeta {
  settingsKey: FeatureSettingsKey;
  label: string;
  description: string;
  /** Feature needs external setup (e.g. an API key) before it is fully usable. */
  requiresExternalSetup?: boolean;
}

export const ONBOARDING_FEATURES: readonly OnboardingFeatureMeta[] = [
  {
    settingsKey: "clock",
    label: "時計",
    description: "必要なときだけ時刻をオーバーレイ表示",
  },
  {
    settingsKey: "calendar",
    label: "カレンダー",
    description: "予定をオーバーレイですぐ確認",
  },
  {
    settingsKey: "gameLauncher",
    label: "ゲームランチャー",
    description: "インストール済みゲームをすばやく起動",
  },
  {
    settingsKey: "quickCapture",
    label: "クイックキャプチャー",
    description: "思いつきをすぐにメモとして保存",
  },
  {
    settingsKey: "fileShelf",
    label: "ファイルシェル",
    description: "ファイルやコピーした内容を一時保存",
  },
  {
    settingsKey: "voiceToText",
    label: "音声入力",
    description: "音声ファイルをテキストに変換",
    requiresExternalSetup: true,
  },
  {
    settingsKey: "mintPalette",
    label: "MintPalette",
    description: "すべての機能を検索して呼び出す",
  },
] as const;

export interface OnboardingDraft {
  featureEnabled: Record<FeatureSettingsKey, boolean>;
  shortcuts: Record<string, string>;
  settingsShortcut: string;
  theme: ThemeMode;
  autostart: boolean;
}

export const buildDraftFromSettings = (
  settings: AppSettings,
): OnboardingDraft => {
  const featureEnabled = {} as Record<FeatureSettingsKey, boolean>;
  const shortcuts: Record<string, string> = {};
  for (const meta of ONBOARDING_FEATURES) {
    featureEnabled[meta.settingsKey] = settings[meta.settingsKey].enabled;
    shortcuts[meta.settingsKey] = settings[meta.settingsKey].shortcut;
  }
  return {
    featureEnabled,
    shortcuts,
    settingsShortcut: settings.settingsShortcut,
    theme: settings.theme,
    autostart: settings.autostart,
  };
};

const applyFeature = <K extends FeatureSettingsKey>(
  settings: AppSettings,
  key: K,
  enabled: boolean,
  shortcut: string,
): AppSettings => ({
  ...settings,
  [key]: { ...settings[key], enabled, shortcut },
});

export const applyDraftToSettings = (
  settings: AppSettings,
  draft: OnboardingDraft,
): AppSettings => {
  let next: AppSettings = {
    ...settings,
    settingsShortcut: draft.settingsShortcut,
    theme: draft.theme,
    autostart: draft.autostart,
  };
  for (const meta of ONBOARDING_FEATURES) {
    next = applyFeature(
      next,
      meta.settingsKey,
      draft.featureEnabled[meta.settingsKey],
      draft.shortcuts[meta.settingsKey] ?? next[meta.settingsKey].shortcut,
    );
  }
  return next;
};

export interface OnboardingRecommendedAction {
  target: OverlayTarget;
  title: string;
  description: string;
}

export const getRecommendedAction = (
  draft: OnboardingDraft,
): OnboardingRecommendedAction | null => {
  if (draft.featureEnabled.quickCapture) {
    return {
      target: "quickCapture",
      title: "ショートカットで最初のメモを書く",
      description: "クイックキャプチャーを開いて、すぐに入力を始めます。",
    };
  }
  if (draft.featureEnabled.mintPalette) {
    return {
      target: "mintPalette",
      title: "Paletteを開いて機能を検索する",
      description: "コマンドパレットで、機能や設定を検索して呼び出します。",
    };
  }
  if (draft.featureEnabled.calendar) {
    return {
      target: "calendar",
      title: "今日の予定を確認する",
      description: "カレンダーオーバーレイを開いて予定を確認します。",
    };
  }
  if (draft.featureEnabled.clock) {
    return {
      target: "clock",
      title: "時計を表示する",
      description: "時計オーバーレイを表示します。",
    };
  }
  return null;
};
