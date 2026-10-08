import type { AppSettings } from "../settingsModel";

const valuesAreEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (
    left === null ||
    right === null ||
    typeof left !== "object" ||
    typeof right !== "object"
  ) {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    return (
      left.length === right.length &&
      left.every((value, index) => valuesAreEqual(value, right[index]))
    );
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        rightKeys.includes(key) &&
        valuesAreEqual(leftRecord[key], rightRecord[key]),
    )
  );
};

export const settingsAreEqual = (
  left: AppSettings | null,
  right: AppSettings,
) => valuesAreEqual(left, right);

export const requiresImmediateSettingsSave = (
  previous: AppSettings,
  next: AppSettings,
) =>
  previous.autostart !== next.autostart ||
  previous.theme !== next.theme ||
  previous.settingsShortcut !== next.settingsShortcut ||
  previous.clock.enabled !== next.clock.enabled ||
  previous.clock.shortcut !== next.clock.shortcut ||
  previous.calendar.enabled !== next.calendar.enabled ||
  previous.calendar.shortcut !== next.calendar.shortcut ||
  previous.calendar.createEventShortcut !== next.calendar.createEventShortcut ||
  previous.gameLauncher.enabled !== next.gameLauncher.enabled ||
  previous.gameLauncher.shortcut !== next.gameLauncher.shortcut;
