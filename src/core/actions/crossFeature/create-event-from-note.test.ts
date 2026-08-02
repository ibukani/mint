import { describe, expect, it } from "vitest";
import { createMockSettings } from "../../mocks/mockSettings";
import { executeCrossFeatureAction } from "../execution";
import type { ActionPorts } from "../ports";
import type { ActionContext } from "../types";
import { createEventFromNoteAction } from "./create-event-from-note";

const createPorts = (): ActionPorts => ({
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
    isSupportedAudioPath: () => true,
    openWithAudioFile: async () => undefined,
  },
  calendar: { openCreateEvent: async () => undefined },
  fileShelf: { getItem: async () => null },
});

const createContext = (): ActionContext => ({
  settings: structuredClone(createMockSettings()),
  ports: createPorts(),
});

describe("createEventFromNoteAction", () => {
  it("opens the calendar editor prefilled from the note", async () => {
    let receivedPayload: unknown;
    const ports = createPorts();
    ports.calendar.openCreateEvent = async (payload) => {
      receivedPayload = payload;
    };
    const result = await executeCrossFeatureAction(
      "quick-capture:create-event",
      { title: "週次会議", notes: "アジェンダあり" },
      { settings: structuredClone(createMockSettings()), ports },
    );
    expect(result.status).toBe("success");
    expect(receivedPayload).toEqual({
      mode: "create",
      draftTitle: "週次会議",
      draftNotes: "アジェンダあり",
    });
  });

  it("omits notes when not provided", async () => {
    let receivedPayload: unknown;
    const ports = createPorts();
    ports.calendar.openCreateEvent = async (payload) => {
      receivedPayload = payload;
    };
    await executeCrossFeatureAction(
      "quick-capture:create-event",
      { title: "会議" },
      { settings: structuredClone(createMockSettings()), ports },
    );
    expect(receivedPayload).toEqual({
      mode: "create",
      draftTitle: "会議",
      draftNotes: undefined,
    });
  });

  it("rejects an empty title", async () => {
    const context = createContext();
    const result = await executeCrossFeatureAction(
      "quick-capture:create-event",
      { title: "   " },
      context,
    );
    expect(result.status).toBe("validationError");
  });

  it("rejects an overly long title", async () => {
    const context = createContext();
    const result = await executeCrossFeatureAction(
      "quick-capture:create-event",
      { title: "あ".repeat(201) },
      context,
    );
    expect(result.status).toBe("validationError");
  });

  it("is unavailable when calendar is disabled", () => {
    const settings = structuredClone(createMockSettings());
    settings.calendar.enabled = false;
    const availability = createEventFromNoteAction.availability({
      settings,
      ports: createPorts(),
    });
    expect(availability).toMatchObject({
      available: false,
      disabledSettingsTarget: { tabId: "calendar" },
    });
  });
});
