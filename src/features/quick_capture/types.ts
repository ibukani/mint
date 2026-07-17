export interface QuickCaptureSettings {
  enabled: boolean;
  shortcut: string;
  themeColor: string;
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
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  attachments: QuickCaptureAttachment[];
}

export interface QuickCaptureAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storedPath: string;
  createdAt: string;
}

export interface QuickCaptureState {
  draft: QuickCaptureDraft;
  notes: QuickCaptureNote[];
}

export interface QuickCapturePromotion {
  note: QuickCaptureNote;
  draft: QuickCaptureDraft;
}

export interface QuickCaptureDraftInput {
  content: string;
  tags: string[];
}

export interface QuickCaptureNoteInput extends QuickCaptureDraftInput {
  pinned: boolean;
}

export interface QuickCaptureAttachmentInput {
  noteId: string;
  sourcePath: string;
}

export interface QuickCaptureExportInput {
  path: string;
  content: string;
  tags: string[];
}
