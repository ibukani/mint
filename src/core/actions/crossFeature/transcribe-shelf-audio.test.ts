import { describe, expect, it } from "vitest";
import type { FileShelfItem } from "../../../features/file_shelf/types";
import { createMockSettings } from "../../mocks/mockSettings";
import { executeCrossFeatureAction } from "../execution";
import type { ActionPorts } from "../ports";
import type { ActionContext } from "../types";
import { transcribeShelfAudioAction } from "./transcribe-shelf-audio";

const createAudioItem = (
  overrides: Partial<FileShelfItem> = {},
): FileShelfItem => ({
  id: "item-1",
  groupId: "group-1",
  kind: "file",
  displayName: "meeting.wav",
  sourcePath: "/tmp/meeting.wav",
  textContent: null,
  mimeType: "audio/wav",
  sizeBytes: 2048,
  createdAt: "2026-08-01T00:00:00Z",
  availability: "ready",
  source: "manual",
  pinned: false,
  ...overrides,
});

const createPorts = (
  item: FileShelfItem | null,
  isSupported = () => true,
): ActionPorts => ({
  quickCapture: {
    createNote: async (input) => ({
      id: "note-1",
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
    isSupportedAudioPath: isSupported,
    openWithAudioFile: async () => undefined,
  },
  calendar: { openCreateEvent: async () => undefined },
  fileShelf: { getItem: async () => item },
});

const createContext = (
  item: FileShelfItem | null,
  isSupported?: () => boolean,
): ActionContext => {
  const settings = structuredClone(createMockSettings());
  settings.voiceToText.enabled = true;
  return { settings, ports: createPorts(item, isSupported) };
};

describe("transcribeShelfAudioAction", () => {
  it("opens voice to text with the audio file path", async () => {
    let openedPath = "";
    const ports = createPorts(createAudioItem());
    ports.voiceToText.openWithAudioFile = async (path) => {
      openedPath = path;
    };
    const settings = structuredClone(createMockSettings());
    settings.voiceToText.enabled = true;
    const result = await executeCrossFeatureAction(
      "file-shelf:transcribe-audio",
      { itemId: "item-1" },
      { settings, ports },
    );
    expect(result.status).toBe("success");
    expect(openedPath).toBe("/tmp/meeting.wav");
  });

  it("rejects non-file items", async () => {
    const context = createContext(createAudioItem({ kind: "text" }));
    const result = await executeCrossFeatureAction(
      "file-shelf:transcribe-audio",
      { itemId: "item-1" },
      context,
    );
    expect(result.status).toBe("validationError");
  });

  it("rejects items without a source path", async () => {
    const context = createContext(createAudioItem({ sourcePath: null }));
    const result = await executeCrossFeatureAction(
      "file-shelf:transcribe-audio",
      { itemId: "item-1" },
      context,
    );
    expect(result.status).toBe("validationError");
  });

  it("rejects unsupported audio formats", async () => {
    const context = createContext(createAudioItem(), () => false);
    const result = await executeCrossFeatureAction(
      "file-shelf:transcribe-audio",
      { itemId: "item-1" },
      context,
    );
    expect(result.status).toBe("validationError");
  });

  it("is unavailable when voice to text is disabled", () => {
    const settings = structuredClone(createMockSettings());
    settings.voiceToText.enabled = false;
    const availability = transcribeShelfAudioAction.availability({
      settings,
      ports: createPorts(createAudioItem()),
    });
    expect(availability).toMatchObject({
      available: false,
      disabledSettingsTarget: { tabId: "voiceToText" },
    });
  });

  it("fails when the item is missing", async () => {
    const context = createContext(null);
    const result = await executeCrossFeatureAction(
      "file-shelf:transcribe-audio",
      { itemId: "missing" },
      context,
    );
    expect(result.status).toBe("failed");
  });
});
