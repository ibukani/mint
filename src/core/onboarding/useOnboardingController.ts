import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useSettings,
  useSettingsSaveStatus,
  useUpdateSettings,
} from "../context/AppSettings";
import { settingsAreEqual } from "../persistence/settingsChangePolicy";
import {
  applyDraftToSettings,
  buildDraftFromSettings,
  ONBOARDING_VERSION,
  type OnboardingDraft,
} from "./onboardingModel";
import { findDuplicateShortcuts } from "./onboardingValidation";

export const ONBOARDING_STEP_COUNT = 4;

export interface OnboardingController {
  draft: OnboardingDraft | null;
  step: number;
  totalSteps: number;
  shortcutErrors: Record<string, string>;
  isCommitting: boolean;
  commitError: string | null;
  updateFeatureEnabled: (settingsKey: string, enabled: boolean) => void;
  updateShortcut: (settingsKey: string, shortcut: string) => void;
  updateSettingsShortcut: (shortcut: string) => void;
  updateTheme: (theme: OnboardingDraft["theme"]) => void;
  updateAutostart: (autostart: boolean) => void;
  goNext: () => void;
  goBack: () => void;
  commit: () => void;
  skip: () => void;
}

export const useOnboardingController = (
  onComplete: () => void,
): OnboardingController => {
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
  const saveStatus = useSettingsSaveStatus();
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [step, setStep] = useState(0);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  useEffect(() => {
    if (settings && !draft) {
      setDraft(buildDraftFromSettings(settings));
    }
  }, [settings, draft]);

  const shortcutErrors = useMemo(() => {
    if (!settings || !draft) return {};
    return findDuplicateShortcuts(draft, settings);
  }, [settings, draft]);

  const updateFeatureEnabled = useCallback(
    (settingsKey: string, enabled: boolean) => {
      setDraft((current) =>
        current
          ? {
              ...current,
              featureEnabled: {
                ...current.featureEnabled,
                [settingsKey]: enabled,
              },
            }
          : current,
      );
    },
    [],
  );

  const updateShortcut = useCallback(
    (settingsKey: string, shortcut: string) => {
      setDraft((current) =>
        current
          ? {
              ...current,
              shortcuts: { ...current.shortcuts, [settingsKey]: shortcut },
            }
          : current,
      );
    },
    [],
  );

  const updateSettingsShortcut = useCallback((shortcut: string) => {
    setDraft((current) =>
      current ? { ...current, settingsShortcut: shortcut } : current,
    );
  }, []);

  const updateTheme = useCallback((theme: OnboardingDraft["theme"]) => {
    setDraft((current) => (current ? { ...current, theme } : current));
  }, []);

  const updateAutostart = useCallback((autostart: boolean) => {
    setDraft((current) => (current ? { ...current, autostart } : current));
  }, []);

  const goNext = useCallback(() => {
    setStep((current) => Math.min(current + 1, ONBOARDING_STEP_COUNT - 1));
  }, []);

  const goBack = useCallback(() => {
    setStep((current) => Math.max(current - 1, 0));
  }, []);

  const markComplete = useCallback(() => {
    updateSettings({
      onboarding: {
        completedVersion: ONBOARDING_VERSION,
        completedAt: new Date().toISOString(),
      },
    });
    setIsCommitting(false);
    onComplete();
  }, [updateSettings, onComplete]);

  const commit = useCallback(() => {
    if (!settings || !draft || isCommitting) return;
    setCommitError(null);

    if (Object.keys(shortcutErrors).length > 0) {
      setStep(1);
      setCommitError(
        "ショートカットキーが重複しています。先に解消してください。",
      );
      return;
    }

    const merged = applyDraftToSettings(settings, draft);
    if (settingsAreEqual(settings, merged)) {
      markComplete();
      return;
    }

    setIsCommitting(true);
    updateSettings(merged);
  }, [
    settings,
    draft,
    isCommitting,
    shortcutErrors,
    markComplete,
    updateSettings,
  ]);

  useEffect(() => {
    if (!isCommitting) return;
    if (saveStatus === "saved") {
      markComplete();
    } else if (saveStatus === "error") {
      setIsCommitting(false);
      setCommitError("設定の保存に失敗しました。もう一度お試しください。");
    }
  }, [isCommitting, saveStatus, markComplete]);

  const skip = useCallback(() => {
    markComplete();
  }, [markComplete]);

  return {
    draft,
    step,
    totalSteps: ONBOARDING_STEP_COUNT,
    shortcutErrors,
    isCommitting,
    commitError,
    updateFeatureEnabled,
    updateShortcut,
    updateSettingsShortcut,
    updateTheme,
    updateAutostart,
    goNext,
    goBack,
    commit,
    skip,
  };
};
