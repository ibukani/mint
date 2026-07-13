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

  it("maps a legacy duplicate error to every shortcut owner", () => {
    expect(parseShortcutErrors("ショートカットキーが重複しています")).toEqual({
      settings: "ショートカットキーが重複しています",
      clock: "ショートカットキーが重複しています",
      calendar: "ショートカットキーが重複しています",
      calendarCreateEvent: "ショートカットキーが重複しています",
      gameLauncher: "ショートカットキーが重複しています",
      quickCapture: "ショートカットキーが重複しています",
      fileShelf: "ショートカットキーが重複しています",
      voiceToText: "ショートカットキーが重複しています",
    });
  });

  it.each([
    ["設定画面ショートカットの登録に失敗しました", "settings"],
    ["ゲームランチャーショートカットの登録に失敗しました", "gameLauncher"],
    ["クイックキャプチャーショートカットの登録に失敗しました", "quickCapture"],
    ["ファイルシェルショートカットの登録に失敗しました", "fileShelf"],
    ["予定登録ショートカットの登録に失敗しました", "calendarCreateEvent"],
  ])("recognizes legacy failures for %s", (message, feature) => {
    expect(parseShortcutErrors(message)).toEqual({ [feature]: message });
  });
});
