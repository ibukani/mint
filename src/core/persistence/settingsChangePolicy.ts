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

const arraysAreEqual = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

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
  previous.fileShelf.enabled !== next.fileShelf.enabled ||
  previous.fileShelf.shortcut !== next.fileShelf.shortcut ||
  previous.fileShelf.edge !== next.fileShelf.edge ||
  previous.fileShelf.verticalPosition !== next.fileShelf.verticalPosition ||
  previous.fileShelf.edgeHandleEnabled !== next.fileShelf.edgeHandleEnabled ||
  previous.fileShelf.clipboardHistoryEnabled !==
    next.fileShelf.clipboardHistoryEnabled ||
  previous.fileShelf.clipboardHistoryLimit !==
    next.fileShelf.clipboardHistoryLimit ||
  !arraysAreEqual(
    previous.fileShelf.ignoredApplications,
    next.fileShelf.ignoredApplications,
  ) ||
  previous.clock.enabled !== next.clock.enabled ||
  previous.clock.shortcut !== next.clock.shortcut ||
  previous.calendar.enabled !== next.calendar.enabled ||
  previous.calendar.shortcut !== next.calendar.shortcut ||
  previous.calendar.createEventShortcut !== next.calendar.createEventShortcut ||
  previous.gameLauncher.enabled !== next.gameLauncher.enabled ||
  previous.gameLauncher.shortcut !== next.gameLauncher.shortcut ||
  previous.voiceToText.enabled !== next.voiceToText.enabled ||
  previous.voiceToText.shortcut !== next.voiceToText.shortcut;
