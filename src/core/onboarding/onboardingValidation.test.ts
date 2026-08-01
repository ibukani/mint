import { describe, expect, it } from "vitest";
import { createMockSettings } from "../mocks/mockSettings";
import { buildDraftFromSettings } from "./onboardingModel";
import {
  collectDraftShortcuts,
  findDuplicateShortcuts,
  hasShortcutConflicts,
} from "./onboardingValidation";

describe("onboardingValidation", () => {
  it("collects shortcuts for enabled features and the settings shortcut", () => {
    const settings = createMockSettings();
    const draft = buildDraftFromSettings(settings);

    const entries = collectDraftShortcuts(draft, settings);
    const featureIds = entries.map((entry) => entry.featureId);

    expect(featureIds).toContain("settings");
    expect(featureIds).toContain("clock");
    expect(featureIds).toContain("quickCapture");
    expect(featureIds).toContain("calendarCreateEvent");
    expect(
      entries.find((entry) => entry.featureId === "settings")?.shortcut,
    ).toBe(settings.settingsShortcut);
  });

  it("skips disabled features and empty shortcuts", () => {
    const settings = createMockSettings({
      clock: { ...createMockSettings().clock, enabled: false },
    });
    const draft = buildDraftFromSettings(settings);

    const entries = collectDraftShortcuts(draft, settings);
    expect(
      entries.find((entry) => entry.featureId === "clock"),
    ).toBeUndefined();

    const emptyDraft = { ...draft, settingsShortcut: "   " };
    const emptyEntries = collectDraftShortcuts(emptyDraft, settings);
    expect(
      emptyEntries.find((entry) => entry.featureId === "settings"),
    ).toBeUndefined();
  });

  it("does not report conflicts for unique shortcuts", () => {
    const settings = createMockSettings();
    const draft = buildDraftFromSettings(settings);

    expect(findDuplicateShortcuts(draft, settings)).toEqual({});
    expect(hasShortcutConflicts(draft, settings)).toBe(false);
  });

  it("reports both sides of a duplicate shortcut", () => {
    const settings = createMockSettings();
    const draft = buildDraftFromSettings(settings);

    const conflicting = {
      ...draft,
      shortcuts: {
        ...draft.shortcuts,
        clock: "Alt+3",
      },
    };

    const errors = findDuplicateShortcuts(conflicting, settings);
    expect(errors.clock).toBeDefined();
    expect(errors.fileShelf).toBeDefined();
    expect(hasShortcutConflicts(conflicting, settings)).toBe(true);
  });

  it("reports conflicts with the calendar create-event shortcut", () => {
    const settings = createMockSettings();
    const draft = buildDraftFromSettings(settings);
    const conflicting = {
      ...draft,
      shortcuts: {
        ...draft.shortcuts,
        gameLauncher: settings.calendar.createEventShortcut,
      },
    };

    const errors = findDuplicateShortcuts(conflicting, settings);
    expect(errors.gameLauncher).toBeDefined();
    expect(errors.calendarCreateEvent).toBeDefined();
  });

  it("ignores conflicts from disabled features", () => {
    const settings = createMockSettings({
      fileShelf: { ...createMockSettings().fileShelf, enabled: false },
    });
    const draft = buildDraftFromSettings(settings);
    const conflicting = {
      ...draft,
      shortcuts: { ...draft.shortcuts, clock: "Alt+3" },
    };

    expect(findDuplicateShortcuts(conflicting, settings)).toEqual({});
  });
});
