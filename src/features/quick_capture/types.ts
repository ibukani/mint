export interface QuickCaptureSettings {
  enabled: boolean;
  shortcut: string;
}

export interface QuickCaptureDraft {
  content: string;
  tags: string[];
  updatedAt: string;
}

export interface QuickCaptureNote {
  id: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QuickCaptureState {
  draft: QuickCaptureDraft;
  notes: QuickCaptureNote[];
}

export interface QuickCaptureDraftInput {
  content: string;
  tags: string[];
}

export interface QuickCaptureNoteInput extends QuickCaptureDraftInput {
  pinned: boolean;
}
