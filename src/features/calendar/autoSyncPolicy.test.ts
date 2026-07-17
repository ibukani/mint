import { afterEach, describe, expect, it } from "vitest";
import {
  AUTOMATIC_GOOGLE_CALENDAR_SYNC_INTERVAL_MS,
  rememberGoogleCalendarSync,
  shouldRunAutomaticGoogleCalendarSync,
} from "./autoSyncPolicy";
import type { GoogleCalendarConnection } from "./types";

const connected = (
  overrides: Partial<GoogleCalendarConnection> = {},
): GoogleCalendarConnection => ({
  connected: true,
  accountEmail: "user@example.com",
  lastSyncedAt: null,
  pendingOperations: 0,
  error: null,
  syncing: false,
  ...overrides,
});

describe("automatic Google Calendar sync policy", () => {
  afterEach(() => window.localStorage.clear());

  it("runs when the selected calendars have no freshness marker", () => {
    expect(shouldRunAutomaticGoogleCalendarSync(connected(), ["primary"])).toBe(
      true,
    );
  });

  it("skips a fresh sync for the same calendar selection", () => {
    const now = Date.parse("2026-07-16T15:00:00.000Z");
    rememberGoogleCalendarSync(["primary", "team"]);

    expect(
      shouldRunAutomaticGoogleCalendarSync(
        connected({ lastSyncedAt: new Date(now - 1_000).toISOString() }),
        ["team", "primary"],
        now,
      ),
    ).toBe(false);
  });

  it("runs again after the freshness interval", () => {
    const now = Date.parse("2026-07-16T15:00:00.000Z");
    rememberGoogleCalendarSync(["primary"]);

    expect(
      shouldRunAutomaticGoogleCalendarSync(
        connected({
          lastSyncedAt: new Date(
            now - AUTOMATIC_GOOGLE_CALENDAR_SYNC_INTERVAL_MS,
          ).toISOString(),
        }),
        ["primary"],
        now,
      ),
    ).toBe(true);
  });

  it("invalidates freshness when the selected calendars change", () => {
    const now = Date.parse("2026-07-16T15:00:00.000Z");
    rememberGoogleCalendarSync(["primary"]);

    expect(
      shouldRunAutomaticGoogleCalendarSync(
        connected({ lastSyncedAt: new Date(now).toISOString() }),
        ["team"],
        now,
      ),
    ).toBe(true);
  });

  it("does not start automatic work for disconnected or busy states", () => {
    expect(
      shouldRunAutomaticGoogleCalendarSync(connected({ connected: false }), [
        "primary",
      ]),
    ).toBe(false);
    expect(
      shouldRunAutomaticGoogleCalendarSync(connected({ syncing: true }), [
        "primary",
      ]),
    ).toBe(false);
    expect(shouldRunAutomaticGoogleCalendarSync(connected(), [])).toBe(false);
  });
});
