import { describe, expect, it } from "vitest";
import { defaultAppSettings } from "../defaultSettings";
import { createMockSettings } from "./mockSettings";

describe("createMockSettings", () => {
  it("returns the default mock settings when no overrides are provided", () => {
    expect(createMockSettings()).toEqual(defaultAppSettings);
  });

  it("deep merges nested feature settings", () => {
    const settings = createMockSettings({
      theme: "light",
      clock: {
        showDate: false,
      },
      voiceToText: {
        model: "gpt-4o-mini-transcribe",
      },
    });

    expect(settings.theme).toBe("light");
    expect(settings.clock).toEqual({
      ...defaultAppSettings.clock,
      showDate: false,
    });
    expect(settings.voiceToText).toEqual({
      ...defaultAppSettings.voiceToText,
      model: "gpt-4o-mini-transcribe",
    });
  });
});
