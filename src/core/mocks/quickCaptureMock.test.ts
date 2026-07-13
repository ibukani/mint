import { beforeEach, describe, expect, it } from "vitest";
import {
  mockCreateQuickCaptureNote,
  mockDeleteQuickCaptureNote,
  mockLoadQuickCaptureState,
  mockSaveQuickCaptureDraft,
  mockUpdateQuickCaptureNote,
} from "./quickCaptureMock";

describe("quickCaptureMock", () => {
  beforeEach(() => localStorage.clear());

  it("persists a draft and normalizes tags", () => {
    mockSaveQuickCaptureDraft({
      content: "途中の文章",
      tags: [" #Work ", "work", ""],
    });

    expect(mockLoadQuickCaptureState().draft).toMatchObject({
      content: "途中の文章",
      tags: ["Work"],
    });
  });

  it("creates, updates, sorts, and deletes notes", () => {
    const first = mockCreateQuickCaptureNote({
      content: "最初のメモ",
      tags: ["inbox"],
      pinned: false,
    });
    const second = mockCreateQuickCaptureNote({
      content: "重要なメモ",
      tags: [],
      pinned: true,
    });
    expect(mockLoadQuickCaptureState().notes[0].id).toBe(second.id);

    const updated = mockUpdateQuickCaptureNote(first.id, {
      content: "更新したメモ",
      tags: ["done"],
      pinned: true,
    });
    expect(updated.tags).toEqual(["done"]);

    mockDeleteQuickCaptureNote(second.id);
    expect(mockLoadQuickCaptureState().notes.map((note) => note.id)).toEqual([
      first.id,
    ]);
  });

  it("rejects empty and missing notes", () => {
    expect(() =>
      mockCreateQuickCaptureNote({ content: " ", tags: [], pinned: false }),
    ).toThrow("メモの本文");
    expect(() => mockDeleteQuickCaptureNote("missing")).toThrow(
      "メモが見つかりません",
    );
  });
});
