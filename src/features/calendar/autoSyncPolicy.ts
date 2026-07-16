import type { GoogleCalendarConnection } from "./types";

// Automatic refreshes should keep the calendar reasonably fresh without
// turning every window reopen into a network and token-refresh operation.
export const AUTOMATIC_GOOGLE_CALENDAR_SYNC_INTERVAL_MS = 5 * 60 * 1000;

const AUTO_SYNC_MARKER_KEY = "mint.google-calendar.auto-sync";

interface AutoSyncMarker {
  calendarFingerprint: string;
}

const calendarFingerprint = (calendarIds: string[]) => {
  // Do not persist calendar IDs themselves; a small stable fingerprint is
  // enough to invalidate the freshness window when the selection changes.
  let hash = 2_166_136_261;
  for (const calendarId of [...calendarIds].sort()) {
    for (const character of calendarId) {
      hash ^= character.codePointAt(0) ?? 0;
      hash = Math.imul(hash, 16_777_619);
    }
    hash ^= 31;
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16);
};

const readAutoSyncMarker = (): AutoSyncMarker | null => {
  try {
    const raw = window.localStorage.getItem(AUTO_SYNC_MARKER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("calendarFingerprint" in parsed) ||
      typeof parsed.calendarFingerprint !== "string"
    ) {
      return null;
    }
    return { calendarFingerprint: parsed.calendarFingerprint };
  } catch {
    return null;
  }
};

export const shouldRunAutomaticGoogleCalendarSync = (
  connection: GoogleCalendarConnection,
  calendarIds: string[],
  now = Date.now(),
) => {
  if (!connection.connected || connection.syncing || calendarIds.length === 0) {
    return false;
  }

  const marker = readAutoSyncMarker();
  if (
    !marker ||
    marker.calendarFingerprint !== calendarFingerprint(calendarIds)
  ) {
    return true;
  }

  const lastSyncedAt = Date.parse(connection.lastSyncedAt ?? "");
  if (!Number.isFinite(lastSyncedAt)) return true;
  return now - lastSyncedAt >= AUTOMATIC_GOOGLE_CALENDAR_SYNC_INTERVAL_MS;
};

export const rememberGoogleCalendarSync = (calendarIds: string[]) => {
  try {
    window.localStorage.setItem(
      AUTO_SYNC_MARKER_KEY,
      JSON.stringify({ calendarFingerprint: calendarFingerprint(calendarIds) }),
    );
  } catch {
    // Storage may be unavailable in a restricted browser context. Automatic
    // sync remains correct; it simply cannot share its freshness marker.
  }
};
