import { describe, expect, it } from "vitest";
import { createMockSettings } from "../mocks/mockSettings";
import {
  applyDraftToSettings,
  buildDraftFromSettings,
  getRecommendedAction,
  ONBOARDING_VERSION,
} from "./onboardingModel";

describe("onboardingModel", () => {
  it("exposes the current onboarding version", () => {
    expect(ONBOARDING_VERSION).toBe(1);
  });

  it("builds a draft from settings with every feature and common settings", () => {
    const base = createMockSettings();
    const settings = createMockSettings({
      theme: "light",
      autostart: true,
      settingsShortcut: "Ctrl+Shift+S",
      clock: { ...base.clock, enabled: false, shortcut: "Alt+Q" },
      voiceToText: { ...base.voiceToText, enabled: false },
    });
    const draft = buildDraftFromSettings(settings);

    expect(draft.theme).toBe("light");
    expect(draft.autostart).toBe(true);
    expect(draft.settingsShortcut).toBe("Ctrl+Shift+S");
    expect(draft.featureEnabled.clock).toBe(false);
    expect(draft.featureEnabled.voiceToText).toBe(false);
    expect(draft.featureEnabled.quickCapture).toBe(true);
    expect(draft.shortcuts.clock).toBe("Alt+Q");
  });

  it("applies the draft to settings without touching unrelated slices", () => {
    const settings = createMockSettings();
    const draft = buildDraftFromSettings(settings);
    const updated = applyDraftToSettings(settings, {
      ...draft,
      featureEnabled: { ...draft.featureEnabled, gameLauncher: false },
      theme: "light",
      autostart: true,
    });

    expect(updated.gameLauncher.enabled).toBe(false);
    expect(updated.theme).toBe("light");
    expect(updated.autostart).toBe(true);
    expect(updated.quickCapture.enabled).toBe(true);
    expect(updated.quickCapture.shortcut).toBe(settings.quickCapture.shortcut);
    expect(updated.calendar.selectedGoogleCalendarIds).toEqual(
      settings.calendar.selectedGoogleCalendarIds,
    );
  });

  it("applies per-feature shortcut changes from the draft", () => {
    const settings = createMockSettings();
    const draft = buildDraftFromSettings(settings);
    const updated = applyDraftToSettings(settings, {
      ...draft,
      shortcuts: { ...draft.shortcuts, fileShelf: "Alt+9" },
    });

    expect(updated.fileShelf.shortcut).toBe("Alt+9");
    expect(updated.clock.shortcut).toBe(settings.clock.shortcut);
  });

  it("picks the recommended first action by feature priority", () => {
    const settings = createMockSettings();
    const draft = buildDraftFromSettings(settings);

    const recommended = getRecommendedAction(draft);
    expect(recommended?.target).toBe("quickCapture");
  });

  it("falls back to the next recommended feature when higher priority is disabled", () => {
    const settings = createMockSettings({
      quickCapture: { ...createMockSettings().quickCapture, enabled: false },
      mintPalette: { ...createMockSettings().mintPalette, enabled: false },
    });
    const draft = buildDraftFromSettings(settings);

    expect(getRecommendedAction(draft)?.target).toBe("calendar");
  });

  it("returns null when no feature is enabled", () => {
    const settings = createMockSettings();
    const draft = buildDraftFromSettings(settings);
    const disabled = {
      ...draft,
      featureEnabled: Object.fromEntries(
        Object.keys(draft.featureEnabled).map((key) => [key, false]),
      ) as typeof draft.featureEnabled,
    };

    expect(getRecommendedAction(disabled)).toBeNull();
  });
});
