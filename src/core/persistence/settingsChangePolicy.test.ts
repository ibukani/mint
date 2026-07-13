import { describe, expect, it } from "vitest";
import { defaultAppSettings } from "../defaultSettings";
import {
  requiresImmediateSettingsSave,
  settingsAreEqual,
} from "./settingsChangePolicy";

const cloneSettings = () => structuredClone(defaultAppSettings);

describe("settings change policy", () => {
  it("treats shortcut and enabled changes as immediate", () => {
    const previous = cloneSettings();
    const next = cloneSettings();
    next.calendar.createEventShortcut = "Ctrl+Shift+C";

    expect(requiresImmediateSettingsSave(previous, next)).toBe(true);
  });

  it("allows presentation-only changes to use the debounce queue", () => {
    const previous = cloneSettings();
    const next = cloneSettings();
    next.clock.clockColor = "#ffffff";

    expect(requiresImmediateSettingsSave(previous, next)).toBe(false);
  });

  it("applies clipboard-history privacy changes immediately", () => {
    const previous = cloneSettings();
    const next = cloneSettings();
    next.fileShelf.clipboardHistoryEnabled = true;

    expect(requiresImmediateSettingsSave(previous, next)).toBe(true);
  });

  it("compares complete settings snapshots", () => {
    const settings = cloneSettings();

    expect(settingsAreEqual(settings, cloneSettings())).toBe(true);
    expect(
      settingsAreEqual(settings, { ...cloneSettings(), theme: "light" }),
    ).toBe(false);
  });
});
