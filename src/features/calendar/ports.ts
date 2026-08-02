import type { CalendarPort } from "../../core/actions/ports";
import { openCalendarEditor } from "./events";
import type { CalendarEditorPayload } from "./types";

/**
 * Public calendar port. Reuses the existing calendar-editor window command so
 * every caller opens the editor through the same validated payload path.
 */
export const calendarPort: CalendarPort = {
  openCreateEvent: (payload: CalendarEditorPayload) =>
    openCalendarEditor(payload),
};
