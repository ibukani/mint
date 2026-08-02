import type { CalendarEditorPayload } from "../../features/calendar/types";
import type { FileShelfItem } from "../../features/file_shelf/types";
import type {
  QuickCaptureNote,
  QuickCaptureNoteInput,
} from "../../features/quick_capture/types";

/**
 * Public ports exposed by each feature. Features implement these ports in
 * `src/features/<feature>/ports.ts` by reusing their existing IPC wrappers.
 * The orchestrator only depends on these interfaces, never on feature
 * components, hooks, or repositories.
 */
export interface QuickCapturePort {
  createNote(input: QuickCaptureNoteInput): Promise<QuickCaptureNote>;
}

export interface VoiceToTextPort {
  isSupportedAudioPath(path: string): boolean;
  openWithAudioFile(path: string): Promise<void>;
}

export interface CalendarPort {
  openCreateEvent(payload: CalendarEditorPayload): Promise<void>;
}

export interface FileShelfPort {
  getItem(itemId: string): Promise<FileShelfItem | null>;
}

export interface ActionPorts {
  quickCapture: QuickCapturePort;
  voiceToText: VoiceToTextPort;
  calendar: CalendarPort;
  fileShelf: FileShelfPort;
}
