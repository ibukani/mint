import { describe, expect, it } from "vitest";
import { defaultAppSettings } from "./defaultSettings";

describe("defaultAppSettings", () => {
  it("contains only the current features and preserves first-run setup", () => {
    expect(defaultAppSettings).not.toHaveProperty("fileShelf");
    expect(defaultAppSettings).not.toHaveProperty("quickCapture");
    expect(defaultAppSettings).not.toHaveProperty("voiceToText");
    expect(defaultAppSettings.onboarding.completedVersion).toBe(0);
    expect(defaultAppSettings.clock.enabled).toBe(true);
    expect(defaultAppSettings.calendar.enabled).toBe(true);
    expect(defaultAppSettings.gameLauncher.enabled).toBe(true);
  });
});
