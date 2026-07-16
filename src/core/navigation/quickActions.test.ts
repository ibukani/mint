import { describe, expect, it } from "vitest";
import { createMockSettings } from "../mocks/mockSettings";
import {
  getAvailableQuickActions,
  SETTINGS_QUICK_ACTIONS,
} from "./quickActions";

describe("getAvailableQuickActions", () => {
  it("keeps actions unchanged while settings are unavailable", () => {
    expect(getAvailableQuickActions(null)).toBe(SETTINGS_QUICK_ACTIONS);
  });

  it("marks an action as disabled when its feature is disabled", () => {
    const settings = createMockSettings({
      calendar: { ...createMockSettings().calendar, enabled: false },
    });

    const calendarAction = getAvailableQuickActions(settings).find(
      (action) => action.targetId === "calendar",
    );
    const createEventAction = getAvailableQuickActions(settings).find(
      (action) => action.targetId === "calendarCreateEvent",
    );

    expect(calendarAction).toMatchObject({
      disabled: true,
      disabledReason: "カレンダーが無効です。詳細設定で有効にしてください。",
      disabledSettingsTarget: {
        tabId: "calendar",
        targetId: "calendar-enabled-checkbox",
      },
    });
    expect(createEventAction).toMatchObject({ disabled: true });
  });

  it("leaves enabled features and theme actions available", () => {
    const actions = getAvailableQuickActions(createMockSettings());

    expect(actions).toHaveLength(SETTINGS_QUICK_ACTIONS.length);
    expect(actions.every((action) => !("disabled" in action))).toBe(true);
  });
});
