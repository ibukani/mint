import type { CalendarEditorPayload } from "../../features/calendar/types";

/** Public calendar operations, shared by core actions and MintPalette. */
export interface CalendarPort {
  openCreateEvent(payload: CalendarEditorPayload): Promise<void>;
}
