import type {
  GoogleCalendarConnection,
  GoogleCalendarInfo,
  GoogleCalendarSyncResult,
} from "../../features/calendar/types";
import type { MockIPCArgs, MockIPCResult } from "./ipcMockTypes";
import { handled, unhandled } from "./ipcMockTypes";

export interface GoogleCalendarIpcMockOptions {
  getConnection?: () =>
    | GoogleCalendarConnection
    | Promise<GoogleCalendarConnection>;
  connect?: () => GoogleCalendarConnection | Promise<GoogleCalendarConnection>;
  listCalendars?: () => GoogleCalendarInfo[] | Promise<GoogleCalendarInfo[]>;
  sync?: (
    calendarIds: string[],
  ) => GoogleCalendarSyncResult | Promise<GoogleCalendarSyncResult>;
  disconnect?: () => unknown | Promise<unknown>;
  defaultConnection: GoogleCalendarConnection;
  defaultConnectedConnection?: GoogleCalendarConnection;
  defaultCalendars: GoogleCalendarInfo[];
}

export async function handleGoogleCalendarIpcCommand(
  command: string,
  args: MockIPCArgs,
  options: GoogleCalendarIpcMockOptions,
): Promise<MockIPCResult> {
  switch (command) {
    case "get_google_calendar_connection":
      return handled(
        await (options.getConnection?.() ?? options.defaultConnection),
      );
    case "connect_google_calendar":
      return handled(
        await (options.connect?.() ??
          options.defaultConnectedConnection ??
          options.defaultConnection),
      );
    case "list_google_calendars":
      return handled(
        await (options.listCalendars?.() ?? options.defaultCalendars),
      );
    case "sync_google_calendars": {
      const calendarIds = (args?.calendarIds as string[] | undefined) ?? [];
      return handled(
        await (options.sync?.(calendarIds) ?? {
          syncedCalendars: calendarIds.length,
          changedEvents: 0,
          pendingOperations: 0,
          syncedAt: new Date().toISOString(),
        }),
      );
    }
    case "disconnect_google_calendar":
      return handled(await options.disconnect?.());
    default:
      return unhandled();
  }
}
