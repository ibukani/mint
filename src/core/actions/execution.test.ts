import { describe, expect, it } from "vitest";
import type { FileShelfItem } from "../../features/file_shelf/types";
import type { QuickCaptureNote } from "../../features/quick_capture/types";
import { createMockSettings } from "../mocks/mockSettings";
import { executeCrossFeatureAction, getActionAvailability } from "./execution";
import type { ActionPorts } from "./ports";
import type { ActionContext } from "./types";

const createNoteMock = (): QuickCaptureNote => ({
  id: "note-1",
  content: "",
  tags: [],
  pinned: false,
  archived: false,
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
  attachments: [],
});

const createPorts = (overrides: Partial<ActionPorts> = {}): ActionPorts => ({
  quickCapture: {
    createNote: async () => createNoteMock(),
  },
  voiceToText: {
    isSupportedAudioPath: () => true,
    openWithAudioFile: async () => undefined,
  },
  calendar: {
    openCreateEvent: async () => undefined,
  },
  fileShelf: {
    getItem: async () => null,
  },
  ...overrides,
});

const createContext = (
  overrides: Partial<ActionContext> = {},
): ActionContext => ({
  settings: structuredClone(createMockSettings()),
  ports: createPorts(),
  ...overrides,
});

const createTextItem = (): FileShelfItem => ({
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
});

describe("getActionAvailability", () => {
  it("reports unavailable for unknown actions", () => {
    const availability = getActionAvailability("nope", createContext());
    expect(availability.available).toBe(false);
  });

  it("reports unavailable when the destination feature is disabled", () => {
    const settings = structuredClone(createMockSettings());
    settings.quickCapture.enabled = false;
    const availability = getActionAvailability(
      "file-shelf:save-as-note",
      createContext({ settings }),
    );
    expect(availability).toMatchObject({
      available: false,
      disabledSettingsTarget: { tabId: "quickCapture" },
    });
  });

  it("reports available when the destination feature is enabled", () => {
    expect(
      getActionAvailability("file-shelf:save-as-note", createContext())
        .available,
    ).toBe(true);
  });
});

describe("executeCrossFeatureAction", () => {
  it("normalizes unknown actions into failed results", async () => {
    const result = await executeCrossFeatureAction("nope", {}, createContext());
    expect(result.status).toBe("failed");
  });

  it("reports unavailable without executing when the feature is disabled", async () => {
    const settings = structuredClone(createMockSettings());
    settings.calendar.enabled = false;
    const ports = createPorts({
      calendar: {
        openCreateEvent: async () => {
          throw new Error("should not execute");
        },
      },
    });
    const result = await executeCrossFeatureAction(
      "quick-capture:create-event",
      { title: "会議" },
      createContext({ settings, ports }),
    );
    expect(result.status).toBe("unavailable");
  });

  it("converts ActionValidationError into validationError results", async () => {
    const result = await executeCrossFeatureAction(
      "quick-capture:create-event",
      { title: "" },
      createContext(),
    );
    expect(result.status).toBe("validationError");
    if (result.status === "validationError") {
      expect(result.message).toContain("タイトル");
    }
  });

  it("returns success and exposes the produced data", async () => {
    const ports = createPorts({
      fileShelf: {
        getItem: async () => createTextItem(),
      },
    });
    const result = await executeCrossFeatureAction(
      "file-shelf:save-as-note",
      { itemId: "item-1" },
      createContext({ ports }),
    );
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data).toEqual({ noteId: "note-1" });
    }
  });

  it("normalizes thrown execution errors into failed results", async () => {
    const ports = createPorts({
      fileShelf: {
        getItem: async () => {
          throw new Error("接続エラー");
        },
      },
    });
    const result = await executeCrossFeatureAction(
      "file-shelf:save-as-note",
      { itemId: "item-1" },
      createContext({ ports }),
    );
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.message).toBe("接続エラー");
    }
  });
});
