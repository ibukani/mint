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
          errors[feature] = "ショートカットキーが重複しています";
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
      errors.clock = "ショートカットキーが重複しています";
      errors.calendar = "ショートカットキーが重複しています";
      errors.calendarCreateEvent = "ショートカットキーが重複しています";
      errors.voiceToText = "ショートカットキーが重複しています";
    } else if (errorMessage.includes("時計")) {
      errors.clock = errorMessage;
    } else if (errorMessage.includes("音声入力")) {
      errors.voiceToText = errorMessage;
    } else if (errorMessage.includes("カレンダー")) {
      errors.calendar = errorMessage;
    }
    return errors;
  }
};
