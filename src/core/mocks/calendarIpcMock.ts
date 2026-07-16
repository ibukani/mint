import type {
  CalendarEditorPayload,
  CalendarEventCursor,
  CalendarEventInput,
  CalendarEventRange,
} from "../../features/calendar/types";
import {
  mockCreateCalendarEvent,
  mockDeleteCalendarEvent,
  mockGetNextCalendarEvent,
  mockListCalendarEvents,
  mockUpdateCalendarEvent,
} from "./calendarEventMock";
import type { MockIPCArgs, MockIPCResult } from "./ipcMockTypes";
import { handled, unhandled } from "./ipcMockTypes";

export async function handleCalendarIpcCommand(
  command: string,
  args: MockIPCArgs,
): Promise<MockIPCResult> {
  switch (command) {
    case "list_calendar_events": {
      const range = args?.range as CalendarEventRange | undefined;
      if (!range) throw new Error("Calendar event range is required.");
      return handled(mockListCalendarEvents(range));
    }
    case "get_next_calendar_event": {
      const cursor = args?.cursor as CalendarEventCursor | undefined;
      if (!cursor) throw new Error("Calendar event cursor is required.");
      return handled(mockGetNextCalendarEvent(cursor));
    }
    case "open_calendar_editor_window": {
      const payload = args?.payload as CalendarEditorPayload | undefined;
      const mode = payload?.mode;
      if (
        !mode ||
        !["create", "edit", "duplicate"].includes(mode) ||
        (mode === "edit" && !payload?.event) ||
        (mode === "duplicate" && !payload?.template)
      ) {
        throw new Error("Calendar editor payload is required.");
      }
      return handled(undefined);
    }
    case "get_calendar_editor_payload":
      return handled(null);
    case "create_calendar_event": {
      const input = args?.input as CalendarEventInput | undefined;
      if (!input) throw new Error("Calendar event input is required.");
      return handled(mockCreateCalendarEvent(input));
    }
    case "update_calendar_event": {
      const id = args?.id as string | undefined;
      const input = args?.input as CalendarEventInput | undefined;
      if (!id || !input) throw new Error("Calendar event update is invalid.");
      return handled(mockUpdateCalendarEvent(id, input));
    }
    case "delete_calendar_event": {
      const id = args?.id as string | undefined;
      if (!id) throw new Error("Calendar event id is required.");
      mockDeleteCalendarEvent(id);
      return handled(undefined);
    }
    default:
      return unhandled();
  }
}
