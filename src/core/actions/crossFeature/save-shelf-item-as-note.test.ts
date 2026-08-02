import { describe, expect, it } from "vitest";
import type { FileShelfItem } from "../../../features/file_shelf/types";
import { createMockSettings } from "../../mocks/mockSettings";
import { executeCrossFeatureAction } from "../execution";
import type { ActionPorts } from "../ports";
import type { ActionContext } from "../types";
import { saveShelfItemAsNoteAction } from "./save-shelf-item-as-note";

const createTextItem = (
  overrides: Partial<FileShelfItem> = {},
): FileShelfItem => ({
  id: "item-1",
  groupId: "group-1",
  kind: "text",
  displayName: "メモ.txt",
  sourcePath: null,
  textContent: "保存したい内容",
  mimeType: "text/plain",
  sizeBytes: null,
  createdAt: "2026-08-01T00:00:00Z",
  availability: "ready",
  source: "manual",
  pinned: false,
  ...overrides,
});

const createPorts = (item: FileShelfItem | null): ActionPorts => ({
  quickCapture: {
    createNote: async (input) => ({
      id: "note-created",
      content: input.content,
      tags: input.tags,
      pinned: input.pinned,
      archived: false,
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
      attachments: [],
    }),
  },
  voiceToText: {
    isSupportedAudioPath: () => true,
    openWithAudioFile: async () => undefined,
  },
  calendar: { openCreateEvent: async () => undefined },
  fileShelf: { getItem: async () => item },
});

const createContext = (item: FileShelfItem | null): ActionContext => ({
  settings: structuredClone(createMockSettings()),
  ports: createPorts(item),
});

describe("saveShelfItemAsNoteAction", () => {
  it("saves a text item as a new note", async () => {
    const context = createContext(createTextItem());
    const result = await executeCrossFeatureAction(
      "file-shelf:save-as-note",
      { itemId: "item-1" },
      context,
    );
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data).toEqual({ noteId: "note-created" });
    }
  });

  it("saves a url item using its text content", async () => {
    const context = createContext(
      createTextItem({
        id: "item-2",
        kind: "url",
        textContent: "https://example.com",
      }),
    );
    const result = await executeCrossFeatureAction(
      "file-shelf:save-as-note",
      { itemId: "item-2" },
      context,
    );
    expect(result.status).toBe("success");
  });

  it("rejects non-text and non-url items", async () => {
    const context = createContext(createTextItem({ kind: "file" }));
    const result = await executeCrossFeatureAction(
      "file-shelf:save-as-note",
      { itemId: "item-1" },
      context,
    );
    expect(result.status).toBe("validationError");
  });

  it("rejects empty content", async () => {
    const context = createContext(createTextItem({ textContent: "   " }));
    const result = await executeCrossFeatureAction(
      "file-shelf:save-as-note",
      { itemId: "item-1" },
      context,
    );
    expect(result.status).toBe("validationError");
  });

  it("rejects malformed urls", async () => {
    const context = createContext(
      createTextItem({ kind: "url", textContent: "not-a-url" }),
    );
    const result = await executeCrossFeatureAction(
      "file-shelf:save-as-note",
      { itemId: "item-1" },
      context,
    );
    expect(result.status).toBe("validationError");
  });

  it("fails when the item is missing", async () => {
    const context = createContext(null);
    const result = await executeCrossFeatureAction(
      "file-shelf:save-as-note",
      { itemId: "missing" },
      context,
    );
    expect(result.status).toBe("failed");
  });

  it("is unavailable when quick capture is disabled", () => {
    const settings = structuredClone(createMockSettings());
    settings.quickCapture.enabled = false;
    const availability = saveShelfItemAsNoteAction.availability({
      settings,
      ports: createPorts(createTextItem()),
    });
    expect(availability).toMatchObject({
      available: false,
      disabledSettingsTarget: { tabId: "quickCapture" },
    });
  });

  it("validates the item id at parse time", () => {
    expect(() =>
      saveShelfItemAsNoteAction.inputSchema.parse({ itemId: "" }),
    ).toThrow(/項目ID/);
  });
});
