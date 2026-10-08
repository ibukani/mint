import { describe, expect, it } from "vitest";
import { SETTINGS_TABS } from "./settingsTabs";

const STABLE_SETTINGS_TAB_ORDER = [
  "general",
  "mintPalette",
  "gameLauncher",
  "clock",
  "calendar",
] as const;

describe("SETTINGS_TABS", () => {
  it("keeps the built-in tabs as a stable prefix", () => {
    expect(
      SETTINGS_TABS.slice(0, STABLE_SETTINGS_TAB_ORDER.length).map(
        (tab) => tab.id,
      ),
    ).toEqual(STABLE_SETTINGS_TAB_ORDER);
  });
});
