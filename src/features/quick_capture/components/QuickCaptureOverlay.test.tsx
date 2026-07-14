import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { noteTitle, QuickCaptureOverlay } from "./QuickCaptureOverlay";

const dialogMocks = vi.hoisted(() => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: dialogMocks.open,
  save: dialogMocks.save,
}));

describe("QuickCaptureOverlay", () => {
  beforeEach(() => {
    localStorage.clear();
    dialogMocks.open.mockReset().mockResolvedValue(null);
    dialogMocks.save.mockReset().mockResolvedValue(null);
  });

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
        screen.getByRole("option", { name: /# 今日のメモ/ }),
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

    const note = await screen.findByRole("option", { name: /保存済みメモ/ });
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
    render(<QuickCaptureOverlay />);
    const editor = await screen.findByLabelText("メモ本文");
    fireEvent.change(editor, { target: { value: "削除できないメモ" } });
    fireEvent.click(screen.getByRole("button", { name: /メモに保存/ }));

    const note = await screen.findByRole("option", {
      name: /削除できないメモ/,
    });
    fireEvent.click(note);
    await screen.findByRole("button", { name: "削除" });

    localStorage.clear();
    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    const dialog = screen.getByRole("alertdialog", {
      name: "このメモを削除しますか？",
    });
    expect(dialog).toHaveTextContent("添付ファイルも削除され");
    fireEvent.click(within(dialog).getByRole("button", { name: "削除する" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "メモが見つかりません。",
    );
    expect(
      screen.getByText("削除できないメモ", { selector: "h1" }),
    ).toBeInTheDocument();
  });

  it("chooses a backup before asking to replace current notes", async () => {
    dialogMocks.open.mockResolvedValue("/tmp/mint-backup.mintbackup");
    render(<QuickCaptureOverlay />);

    await screen.findByLabelText("メモ本文");
    fireEvent.click(
      screen.getByRole("button", { name: "バックアップから復元する" }),
    );

    const dialog = await screen.findByRole("alertdialog", {
      name: "バックアップから復元しますか？",
    });
    expect(dialog).toHaveTextContent("現在の下書きと保存済みメモ0件");
    expect(dialogMocks.open).toHaveBeenCalledOnce();
    fireEvent.click(within(dialog).getByRole("button", { name: "キャンセル" }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it("focuses the library search and opens notes with the keyboard", async () => {
    localStorage.setItem(
      "mint_mock_quick_capture",
      JSON.stringify({
        draft: {
          content: "編集中の下書き",
          tags: [],
          updatedAt: "2026-07-14T09:00:00.000Z",
        },
        notes: [
          {
            id: "first-note",
            content: "最初のメモ",
            tags: ["work"],
            pinned: false,
            createdAt: "2026-07-14T08:00:00.000Z",
            updatedAt: "2026-07-14T08:00:00.000Z",
            attachments: [],
          },
          {
            id: "second-note",
            content: "次のメモ",
            tags: ["idea"],
            pinned: false,
            createdAt: "2026-07-14T07:00:00.000Z",
            updatedAt: "2026-07-14T07:00:00.000Z",
            attachments: [],
          },
        ],
      }),
    );
    render(<QuickCaptureOverlay />);

    const editor = await screen.findByLabelText("メモ本文");
    await screen.findByRole("option", { name: /最初のメモ/ });
    fireEvent.keyDown(editor, { key: "f", ctrlKey: true });
    const search = screen.getByRole("combobox", {
      name: "保存済みメモを検索",
    });
    expect(search).toHaveFocus();
    expect(search).toHaveAttribute("aria-keyshortcuts", "Control+F /");

    const options = screen.getAllByRole("option");
    expect(search).toHaveAttribute("aria-activedescendant", options[0].id);
    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(search).toHaveAttribute("aria-activedescendant", options[1].id);
    fireEvent.keyDown(search, { key: "Enter" });

    expect(
      await screen.findByRole("heading", { name: "次のメモ" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText("メモ本文")).toHaveFocus(),
    );
  });

  it("clears library filters before Escape closes the overlay", async () => {
    localStorage.setItem(
      "mint_mock_quick_capture",
      JSON.stringify({
        draft: { content: "", tags: [], updatedAt: "2026-07-14T09:00:00.000Z" },
        notes: [
          {
            id: "searchable-note",
            content: "検索できるメモ",
            tags: [],
            pinned: false,
            createdAt: "2026-07-14T08:00:00.000Z",
            updatedAt: "2026-07-14T08:00:00.000Z",
            attachments: [],
          },
        ],
      }),
    );
    render(<QuickCaptureOverlay />);

    const search = await screen.findByRole("combobox", {
      name: "保存済みメモを検索",
    });
    await screen.findByRole("option", { name: /検索できるメモ/ });
    act(() => search.focus());
    fireEvent.change(search, { target: { value: "一致しない" } });
    expect(screen.getByText("一致するメモがありません")).toBeVisible();

    fireEvent.keyDown(search, { key: "Escape" });
    expect(search).toHaveValue("");
    expect(search).toHaveFocus();
    expect(
      screen.getByRole("option", { name: /検索できるメモ/ }),
    ).toBeInTheDocument();
  });
});
