import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { noteTitle, QuickCaptureOverlay } from "./QuickCaptureOverlay";

describe("QuickCaptureOverlay", () => {
  beforeEach(() => localStorage.clear());

  it("renders the overlay in its visible state", async () => {
    render(<QuickCaptureOverlay />);

    expect(await screen.findByRole("dialog")).toHaveClass(
      "overlay-card",
      "quick-capture",
      "is-visible",
    );
  });

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
    expect(screen.getByRole("button", { name: "編集" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "プレビュー" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("メモのプレビュー")).toHaveFocus();
  });

  it("resets draft view state when returning from a saved note", async () => {
    render(<QuickCaptureOverlay />);
    const editor = await screen.findByLabelText("メモ本文");
    fireEvent.change(editor, { target: { value: "保存済みメモ" } });
    fireEvent.click(screen.getByRole("button", { name: /メモに保存/ }));

    const note = await screen.findByRole("button", { name: /保存済みメモ/ });
    fireEvent.click(note);
    const backToDraft = await screen.findByRole("button", {
      name: "下書きへ",
    });
    fireEvent.click(screen.getByRole("button", { name: "プレビュー" }));
    fireEvent.change(screen.getByLabelText("保存済みメモを検索"), {
      target: { value: "古い検索語" },
    });

    fireEvent.click(backToDraft);

    await waitFor(() => {
      expect(screen.getByLabelText("保存済みメモを検索")).toHaveValue("");
      expect(screen.getByRole("button", { name: "編集" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByLabelText("メモ本文")).toHaveFocus();
    });
  });

  it("persists the latest draft before exporting a backup", async () => {
    render(<QuickCaptureOverlay />);
    const editor = await screen.findByLabelText("メモ本文");
    fireEvent.change(editor, {
      target: { value: "バックアップ対象の最新メモ" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "バックアップを書き出す" }),
    );

    await waitFor(() => {
      const stored = localStorage.getItem("mint_mock_quick_capture");
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored ?? "{}").draft.content).toBe(
        "バックアップ対象の最新メモ",
      );
    });
  });

  it("surfaces a delete failure without losing the current note", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    try {
      render(<QuickCaptureOverlay />);
      const editor = await screen.findByLabelText("メモ本文");
      fireEvent.change(editor, { target: { value: "削除できないメモ" } });
      fireEvent.click(screen.getByRole("button", { name: /メモに保存/ }));

      const note = await screen.findByRole("button", {
        name: /削除できないメモ/,
      });
      fireEvent.click(note);
      await screen.findByRole("button", { name: "削除" });

      localStorage.clear();
      fireEvent.click(screen.getByRole("button", { name: "削除" }));

      await waitFor(() =>
        expect(screen.getByText("メモが見つかりません。")).toBeInTheDocument(),
      );
      expect(
        screen.getByRole("heading", { name: "削除できないメモ" }),
      ).toBeInTheDocument();
    } finally {
      confirm.mockRestore();
    }
  });
});
