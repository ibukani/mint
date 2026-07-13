const DUPLICATE_SHORTCUT_MESSAGE = "ショートカットキーが重複しています";

const LEGACY_DUPLICATE_FEATURES = [
  "settings",
  "clock",
  "calendar",
  "calendarCreateEvent",
  "gameLauncher",
  "quickCapture",
  "fileShelf",
  "voiceToText",
] as const;

const LEGACY_FEATURE_MATCHERS = [
  { feature: "clock", terms: ["時計"] },
  { feature: "voiceToText", terms: ["音声入力"] },
  { feature: "calendarCreateEvent", terms: ["予定登録", "予定入力"] },
  { feature: "calendar", terms: ["カレンダー"] },
  { feature: "gameLauncher", terms: ["ゲームランチャー"] },
  { feature: "quickCapture", terms: ["クイックキャプチャー"] },
  { feature: "fileShelf", terms: ["ファイルシェル"] },
  { feature: "settings", terms: ["設定画面", "設定ショートカット"] },
] as const;

export const parseShortcutErrors = (
  errorMessage: string,
): Record<string, string> => {
  const errors: Record<string, string> = {};

  try {
    const parsed: unknown = JSON.parse(errorMessage);
    if (!parsed || typeof parsed !== "object") return errors;

    if (
      "type" in parsed &&
      parsed.type === "duplicateShortcut" &&
      "features" in parsed &&
      Array.isArray(parsed.features)
    ) {
      for (const feature of parsed.features) {
        if (typeof feature === "string") {
          errors[feature] = DUPLICATE_SHORTCUT_MESSAGE;
        }
      }
      return errors;
    }

    if (
      "type" in parsed &&
      parsed.type === "registrationFailed" &&
      "feature" in parsed &&
      typeof parsed.feature === "string" &&
      "message" in parsed &&
      typeof parsed.message === "string"
    ) {
      errors[parsed.feature] = parsed.message;
    }
    return errors;
  } catch {
    if (errorMessage.includes("重複")) {
      for (const feature of LEGACY_DUPLICATE_FEATURES) {
        errors[feature] = DUPLICATE_SHORTCUT_MESSAGE;
      }
      return errors;
    }

    for (const { feature, terms } of LEGACY_FEATURE_MATCHERS) {
      if (terms.some((term) => errorMessage.includes(term))) {
        errors[feature] = errorMessage;
        break;
      }
    }
    return errors;
  }
};
