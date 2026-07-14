export interface FileShelfSettings {
  enabled: boolean;
  shortcut: string;
  edge: "left" | "right";
  edgeHandleEnabled: boolean;
  clipboardHistoryEnabled: boolean;
  clipboardHistoryLimit: number;
  themeColor: string;
}

export type FileShelfItemKind = "file" | "folder" | "image" | "text" | "url";

export type FileShelfAvailability = "ready" | "missing";

export type FileShelfItemSource = "manual" | "clipboardHistory";

export interface FileShelfItem {
  id: string;
  groupId: string;
  kind: FileShelfItemKind;
  displayName: string;
  sourcePath: string | null;
  textContent: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  availability: FileShelfAvailability;
  source: FileShelfItemSource;
}

export interface FileShelfGroup {
  id: string;
  createdAt: string;
  items: FileShelfItem[];
}

export interface FileShelfState {
  groups: FileShelfGroup[];
}

export interface AddFileShelfPathsInput {
  paths: string[];
}

export type AddFileShelfContentInput =
  | { kind: "text"; text: string }
  | { kind: "url"; url: string }
  | {
      kind: "image";
      fileName: string;
      mimeType: string;
      dataBase64: string;
    };

export interface FileShelfMutation {
  state: FileShelfState;
  addedCount: number;
  skippedCount: number;
}

export interface FileShelfRemoval {
  state: FileShelfState;
  undoToken: string;
}
