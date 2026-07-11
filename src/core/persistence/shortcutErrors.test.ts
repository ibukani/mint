import { describe, expect, it } from "vitest";
import { parseShortcutErrors } from "./shortcutErrors";

describe("parseShortcutErrors", () => {
  it("maps duplicate shortcut payloads to every affected feature", () => {
    expect(
      parseShortcutErrors(
        JSON.stringify({
          type: "duplicateShortcut",
          features: ["clock", "calendar"],
        }),
      ),
    ).toEqual({
      clock: "ショートカットキーが重複しています",
      calendar: "ショートカットキーが重複しています",
    });
  });

  it("preserves registration failure messages", () => {
    expect(
      parseShortcutErrors(
        JSON.stringify({
          type: "registrationFailed",
          feature: "gameLauncher",
          message: "登録できませんでした",
        }),
      ),
    ).toEqual({ gameLauncher: "登録できませんでした" });
  });

  it("supports legacy localized error strings", () => {
    expect(
      parseShortcutErrors("時計ショートカットの登録に失敗しました"),
    ).toEqual({ clock: "時計ショートカットの登録に失敗しました" });
  });
});
