import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { noteTitle, QuickCaptureOverlay } from "./QuickCaptureOverlay";

describe("QuickCaptureOverlay", () => {
  beforeEach(() => localStorage.clear());

  it("derives a title from the first non-empty line", () => {
    expect(noteTitle({ content: "\n  見出し  \n本文" })).toBe("見出し");
  });

  it("promotes a draft and exposes it in the library", async () => {
    render(<QuickCaptureOverlay />);
    const editor = await screen.findByLabelText("メモ本文");
    fireEvent.change(editor, { target: { value: "# 今日のメモ\n本文" } });
    fireEvent.change(screen.getByLabelText("タグ"), {
      target: { value: "work, idea" },
    });
    fireEvent.click(screen.getByRole("button", { name: /メモに保存/ }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /# 今日のメモ/ }),
      ).toBeInTheDocument();
      expect(editor).toHaveValue("");
    });
  });

  it("switches to a safe Markdown preview", async () => {
    render(<QuickCaptureOverlay />);
    const editor = await screen.findByLabelText("メモ本文");
    fireEvent.change(editor, { target: { value: "**太字**" } });
    fireEvent.click(screen.getByRole("button", { name: "プレビュー" }));
    expect((await screen.findByText("太字")).tagName).toBe("STRONG");
  });
});
