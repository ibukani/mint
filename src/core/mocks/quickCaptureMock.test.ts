import { beforeEach, describe, expect, it } from "vitest";
import {
  mockAddQuickCaptureAttachment,
  mockCreateQuickCaptureNote,
  mockDeleteQuickCaptureAttachment,
  mockDeleteQuickCaptureNote,
  mockLoadQuickCaptureState,
  mockPromoteQuickCaptureNote,
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

  it("promotes a note and clears the draft as one mock operation", () => {
    mockSaveQuickCaptureDraft({ content: "下書き", tags: ["inbox"] });

    const promotion = mockPromoteQuickCaptureNote({
      content: "保存するメモ",
      tags: ["work"],
      pinned: false,
    });

    expect(promotion.note.content).toBe("保存するメモ");
    expect(mockLoadQuickCaptureState()).toMatchObject({
      draft: { content: "", tags: [] },
      notes: [expect.objectContaining({ id: promotion.note.id })],
    });
  });

  it("rejects empty and missing notes", () => {
    expect(() =>
      mockCreateQuickCaptureNote({ content: " ", tags: [], pinned: false }),
    ).toThrow("メモの本文");
    expect(() => mockDeleteQuickCaptureNote("missing")).toThrow(
      "メモが見つかりません",
    );
  });

  it("keeps attachments with the note and removes them independently", () => {
    const note = mockCreateQuickCaptureNote({
      content: "添付を確認する",
      tags: [],
      pinned: false,
    });
    const attachment = mockAddQuickCaptureAttachment({
      noteId: note.id,
      sourcePath: "/tmp/reference.pdf",
    });
    expect(mockLoadQuickCaptureState().notes[0].attachments).toEqual([
      attachment,
    ]);
    mockDeleteQuickCaptureAttachment(note.id, attachment.id);
    expect(mockLoadQuickCaptureState().notes[0].attachments).toEqual([]);
  });
});
