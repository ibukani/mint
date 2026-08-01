import type { AppSettings } from "../settingsModel";
import { ONBOARDING_FEATURES, type OnboardingDraft } from "./onboardingModel";

const DUPLICATE_SHORTCUT_MESSAGE = "ショートカットキーが重複しています";

export interface ShortcutConflict {
  featureId: string;
  label: string;
}

/**
 * Collect the shortcuts that would be registered globally for the draft,
 * mirroring `AppSettings::active_shortcuts()` on the Rust side.
 * Empty shortcuts are treated as "unset" and skipped.
 */
export const collectDraftShortcuts = (
  draft: OnboardingDraft,
  settings: AppSettings,
): Array<{ featureId: string; shortcut: string }> => {
  const entries: Array<{ featureId: string; shortcut: string }> = [];

  if (draft.settingsShortcut.trim()) {
    entries.push({
      featureId: "settings",
      shortcut: draft.settingsShortcut.trim(),
    });
  }

  for (const meta of ONBOARDING_FEATURES) {
    const enabled = draft.featureEnabled[meta.settingsKey];
    const shortcut = draft.shortcuts[meta.settingsKey]?.trim() ?? "";
    if (enabled && shortcut) {
      entries.push({ featureId: meta.settingsKey, shortcut });
    }
  }

  // The calendar create-event shortcut is registered whenever calendar is
  // enabled, so it participates in duplicate detection too.
  if (
    draft.featureEnabled.calendar &&
    settings.calendar.createEventShortcut.trim()
  ) {
    entries.push({
      featureId: "calendarCreateEvent",
      shortcut: settings.calendar.createEventShortcut.trim(),
    });
  }

  return entries;
};

/**
 * Returns a map of featureId -> human-readable label for every shortcut that
 * participates in a duplicate pair. Empty entries are ignored.
 */
export const findDuplicateShortcuts = (
  draft: OnboardingDraft,
  settings: AppSettings,
): Record<string, string> => {
  const seen = new Map<string, string>();
  const conflicts: Record<string, string> = {};

  for (const { featureId, shortcut } of collectDraftShortcuts(
    draft,
    settings,
  )) {
    const existing = seen.get(shortcut);
    if (existing !== undefined && existing !== featureId) {
      conflicts[existing] = DUPLICATE_SHORTCUT_MESSAGE;
      conflicts[featureId] = DUPLICATE_SHORTCUT_MESSAGE;
    } else {
      seen.set(shortcut, featureId);
    }
  }

  return conflicts;
};

export const hasShortcutConflicts = (
  draft: OnboardingDraft,
  settings: AppSettings,
): boolean => Object.keys(findDuplicateShortcuts(draft, settings)).length > 0;
