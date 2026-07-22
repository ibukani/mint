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
const windowMocks = vi.hoisted(() => ({
  hide: vi.fn(),
  isVisible: vi.fn(),
}));
const clipboardMocks = vi.hoisted(() => ({
  readText: vi.fn(),
  writeText: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: dialogMocks.open,
  save: dialogMocks.save,
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    hide: windowMocks.hide,
    isVisible: windowMocks.isVisible,
    onFocusChanged: async () => () => {},
  }),
}));

vi.mock("../../../core/context/AppSettings", () => ({
  useAppSettings: () => ({ settings: undefined }),
}));

describe("QuickCaptureOverlay", () => {
  beforeEach(() => {
    localStorage.clear();
    dialogMocks.open.mockReset().mockResolvedValue(null);
    dialogMocks.save.mockReset().mockResolvedValue(null);
    windowMocks.hide.mockReset().mockResolvedValue(undefined);
    windowMocks.isVisible.mockReset().mockResolvedValue(true);
    clipboardMocks.readText.mockReset().mockResolvedValue("");
    clipboardMocks.writeText.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: clipboardMocks,
    });
  });

  it("renders the overlay in its visible state", async () => {
    render(<QuickCaptureOverlay />);

    expect(await screen.findByRole("dialog")).toHaveClass(
      "overlay-card",
      "quick-capture",
      "is-visible",
    );
  });

  it("toggles window pinning separately from note pinning", async () => {
    render(<QuickCaptureOverlay />);

    const pin = await screen.findByRole("button", {
      name: "ウィンドウを固定",
    });
    expect(pin).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(pin);

    const unpin = screen.getByRole("button", {
      name: "ウィンドウの固定を解除",
    });
    expect(unpin).toHaveAttribute("aria-pressed", "true");
    expect(unpin).toHaveTextContent("固定中");
  });

  it("derives a title from the first non-empty line", () => {
    expect(noteTitle({ content: "\n  見出し  \n本文" })).toBe("見出し");
  });

  it("displays line and character stats in the editor and line count in library notes", async () => {
    localStorage.setItem(
      "mint_mock_quick_capture",
      JSON.stringify({
        draft: { content: "", tags: [], updatedAt: "2026-07-14T09:00:00.000Z" },
        notes: [
          {
            id: "line-count-note",
            content: "1行目\n2行目\n3行目",
            tags: [],
            pinned: false,
            archived: false,
            createdAt: "2026-07-14T08:00:00.000Z",
            updatedAt: "2026-07-14T08:00:00.000Z",
            attachments: [],
          },
        ],
      }),
    );
    render(<QuickCaptureOverlay />);
    const editor = (await screen.findByLabelText(
      "メモ本文",
    )) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "1行目\n2行目\n3行目" } });

    const stats = screen.getByTitle("文字数と行数");
    expect(stats).toHaveTextContent("3 行 (11 文字)");

    const lineNumbers = editor.parentElement?.querySelector(
      ".quick-capture__line-numbers",
    );
    expect(lineNumbers).toHaveTextContent("123");

    const noteOption = await screen.findByRole("option", { name: /1行目/ });
    expect(noteOption).toHaveTextContent("3行");
  });

  it("promotes a draft and exposes it in the library", async () => {
    render(<QuickCaptureOverlay />);
    const editor = (await screen.findByLabelText(
      "メモ本文",
    )) as HTMLTextAreaElement;
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

  it("formats a selected phrase as Markdown", async () => {
    render(<QuickCaptureOverlay />);
    const editor = (await screen.findByLabelText(
      "メモ本文",
    )) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "選択する本文" } });
    editor.setSelectionRange(0, 2);

    fireEvent.click(screen.getByRole("button", { name: "太字" }));

    await waitFor(() => expect(editor).toHaveValue("**選択**する本文"));
  });

  it("formats selected lines with a Markdown block action", async () => {
    render(<QuickCaptureOverlay />);
    const editor = (await screen.findByLabelText(
      "メモ本文",
    )) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "一つ目\n二つ目" } });
    editor.setSelectionRange(0, editor.value.length);

    fireEvent.click(screen.getByRole("button", { name: "チェックリスト" }));

    await waitFor(() =>
      expect(editor).toHaveValue("- [ ] 一つ目\n- [ ] 二つ目"),
    );
  });

  it("formats the current selection with the keyboard shortcut", async () => {
    render(<QuickCaptureOverlay />);
    const editor = (await screen.findByLabelText(
      "メモ本文",
    )) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "キーボード書式" } });
    editor.setSelectionRange(0, 5);

    fireEvent.keyDown(editor, { key: "b", ctrlKey: true });

    await waitFor(() => expect(editor).toHaveValue("**キーボード**書式"));
  });

  it("continues Markdown checklists when pressing Enter", async () => {
    render(<QuickCaptureOverlay />);
    const editor = (await screen.findByLabelText(
      "メモ本文",
    )) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "- [ ] 最初の作業" } });
    editor.setSelectionRange(editor.value.length, editor.value.length);

    fireEvent.keyDown(editor, { key: "Enter" });

    await waitFor(() => expect(editor).toHaveValue("- [ ] 最初の作業\n- [ ] "));
  });

  it("indents selected Markdown lines with Tab and outdents with Shift+Tab", async () => {
    render(<QuickCaptureOverlay />);
    const editor = (await screen.findByLabelText(
      "メモ本文",
    )) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "項目1\n項目2" } });
    editor.setSelectionRange(0, editor.value.length);

    fireEvent.keyDown(editor, { key: "Tab" });
    await waitFor(() => expect(editor).toHaveValue("  項目1\n  項目2"));

    editor.setSelectionRange(2, editor.value.length);
    fireEvent.keyDown(editor, { key: "Tab", shiftKey: true });
    await waitFor(() => expect(editor).toHaveValue("項目1\n項目2"));
  });

  it("inserts a Markdown template and keeps the editor ready for typing", async () => {
    render(<QuickCaptureOverlay />);
    const editor = (await screen.findByLabelText(
      "メモ本文",
    )) as HTMLTextAreaElement;

    fireEvent.click(screen.getByRole("button", { name: "テンプレート" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /タスク/ }));

    await waitFor(() => {
      expect(editor).toHaveValue("## タスク\n\n- [ ] ");
      expect(screen.getByLabelText("タグ")).toHaveValue("task");
      expect(screen.getByRole("status")).toHaveTextContent(
        "タスクテンプレートを挿入しました",
      );
      expect(editor).toHaveFocus();
    });
  });

  it("copies the current draft to the clipboard", async () => {
    render(<QuickCaptureOverlay />);
    const editor = await screen.findByLabelText("メモ本文");
    fireEvent.change(editor, { target: { value: "共有する本文" } });

    fireEvent.click(await screen.findByRole("button", { name: "コピー" }));

    await waitFor(() => {
      expect(clipboardMocks.writeText).toHaveBeenCalledWith("共有する本文");
      expect(screen.getByRole("status")).toHaveTextContent(
        "クリップボードへコピーしました",
      );
    });
  });

  it("saves clipboard text as a new note without replacing the current draft", async () => {
    clipboardMocks.readText.mockResolvedValue("別の場所から取り込むメモ");
    render(<QuickCaptureOverlay />);
    const editor = await screen.findByLabelText("メモ本文");
    fireEvent.change(editor, { target: { value: "編集中の下書き" } });

    fireEvent.click(
      await screen.findByRole("button", {
        name: "クリップボードを新しいメモとして保存",
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: /別の場所から取り込むメモ/ }),
      ).toBeInTheDocument();
      expect(editor).toHaveValue("編集中の下書き");
      expect(screen.getByRole("status")).toHaveTextContent(
        "クリップボードを新しいメモとして保存しました",
      );
    });
  });

  it("copies a saved note directly from the library", async () => {
    render(<QuickCaptureOverlay />);
    const editor = await screen.findByLabelText("メモ本文");
    fireEvent.change(editor, { target: { value: "一覧からコピーするメモ" } });
    fireEvent.click(screen.getByRole("button", { name: /メモに保存/ }));

    fireEvent.click(
      await screen.findByRole("button", {
        name: "「一覧からコピーするメモ」をコピー",
      }),
    );

    await waitFor(() => {
      expect(clipboardMocks.writeText).toHaveBeenCalledWith(
        "一覧からコピーするメモ",
      );
      expect(screen.getByRole("status")).toHaveTextContent(
        "メモをクリップボードへコピーしました",
      );
    });
  });

  it("deletes a saved note from the library after confirmation", async () => {
    localStorage.setItem(
      "mint_mock_quick_capture",
      JSON.stringify({
        draft: {
          content: "残しておく下書き",
          tags: [],
          updatedAt: "2026-07-15T03:00:00.000Z",
        },
        notes: [
          {
            id: "library-delete-note",
            content: "一覧から削除するメモ",
            tags: [],
            pinned: false,
            createdAt: "2026-07-15T02:00:00.000Z",
            updatedAt: "2026-07-15T02:00:00.000Z",
            attachments: [],
          },
        ],
      }),
    );
    render(<QuickCaptureOverlay />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "「一覧から削除するメモ」を削除",
      }),
    );
    const dialog = screen.getByRole("alertdialog", {
      name: "このメモを削除しますか？",
    });
    expect(dialog).toHaveTextContent("一覧から削除するメモ");
    fireEvent.click(within(dialog).getByRole("button", { name: "削除する" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("option", { name: /一覧から削除するメモ/ }),
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText("メモ本文")).toHaveValue("残しておく下書き");
    });

    fireEvent.click(screen.getByRole("button", { name: "削除を取り消す" }));
    await waitFor(() =>
      expect(
        screen.getByRole("option", { name: /一覧から削除するメモ/ }),
      ).toBeInTheDocument(),
    );
  });

  it("resets draft view state when returning from a saved note", async () => {
    render(<QuickCaptureOverlay />);
    const editor = await screen.findByLabelText("メモ本文");
    fireEvent.change(editor, { target: { value: "保存済みメモ" } });
    fireEvent.click(screen.getByRole("button", { name: /メモに保存/ }));

    const note = await screen.findByRole("option", { name: /保存済みメモ/ });
    fireEvent.click(note);
    const backToDraft = await screen.findByRole("button", {
      name: "新しいメモを作成",
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

  it("duplicates a saved note with the keyboard shortcut", async () => {
    render(<QuickCaptureOverlay />);
    const editor = await screen.findByLabelText("メモ本文");
    fireEvent.change(editor, { target: { value: "定型メモ" } });
    fireEvent.change(screen.getByLabelText("タグ"), {
      target: { value: "work" },
    });
    fireEvent.click(screen.getByRole("button", { name: /メモに保存/ }));

    const note = await screen.findByRole("option", { name: /定型メモ/ });
    fireEvent.click(note);
    const duplicateButton = await screen.findByRole("button", {
      name: "複製",
    });
    expect(duplicateButton).toHaveAttribute(
      "aria-keyshortcuts",
      "Control+Shift+D Meta+Shift+D",
    );

    fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "d",
      ctrlKey: true,
      shiftKey: true,
    });

    await waitFor(() =>
      expect(screen.getAllByRole("option", { name: /定型メモ/ })).toHaveLength(
        2,
      ),
    );
    expect(screen.getByRole("heading", { name: "定型メモ" })).toBeVisible();
  });

  it("toggles pinning and opens a new draft with keyboard shortcuts", async () => {
    render(<QuickCaptureOverlay />);
    const editor = await screen.findByLabelText("メモ本文");
    fireEvent.change(editor, { target: { value: "ショートカット用メモ" } });
    fireEvent.click(screen.getByRole("button", { name: /メモに保存/ }));

    const note = await screen.findByRole("option", {
      name: /ショートカット用メモ/,
    });
    fireEvent.click(note);
    const dialog = screen.getByRole("dialog");
    const pinButton = await screen.findByRole("button", { name: "ピン留め" });
    expect(pinButton).toHaveAttribute(
      "aria-keyshortcuts",
      "Control+Shift+P Meta+Shift+P",
    );

    fireEvent.keyDown(dialog, { key: "p", ctrlKey: true, shiftKey: true });
    await waitFor(() =>
      expect(pinButton).toHaveAttribute("aria-pressed", "true"),
    );

    const draftButton = screen.getByRole("button", {
      name: "新しいメモを作成",
    });
    expect(draftButton).toHaveAttribute(
      "aria-keyshortcuts",
      "Control+N Meta+N",
    );
    fireEvent.keyDown(dialog, { key: "n", ctrlKey: true });

    await waitFor(() => {
      expect(screen.getByLabelText("メモ本文")).toHaveValue("");
      expect(screen.getByText("思いついたことを、そのままメモ")).toBeVisible();
    });
  });

  it("keeps the new-note action visible and starts another blank note", async () => {
    render(<QuickCaptureOverlay />);
    const editor = await screen.findByLabelText("メモ本文");
    const newNoteButton = screen.getByRole("button", {
      name: "新しいメモを作成",
    });
    expect(newNoteButton).toBeVisible();
    expect(newNoteButton).toHaveTextContent("");

    fireEvent.change(editor, { target: { value: "次へ進む前のメモ" } });
    fireEvent.click(newNoteButton);

    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: /次へ進む前のメモ/ }),
      ).toBeVisible();
      expect(screen.getByLabelText("メモ本文")).toHaveValue("");
      expect(
        screen.getByRole("button", { name: "新しいメモを作成" }),
      ).toBeVisible();
    });
  });

  it("filters the library to pinned notes and restores the full list", async () => {
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
            id: "pinned-note",
            content: "いつもの定型文",
            tags: ["template"],
            pinned: true,
            createdAt: "2026-07-14T08:00:00.000Z",
            updatedAt: "2026-07-14T08:00:00.000Z",
            attachments: [],
          },
          {
            id: "regular-note",
            content: "通常のメモ",
            tags: ["work"],
            pinned: false,
            createdAt: "2026-07-14T07:00:00.000Z",
            updatedAt: "2026-07-14T07:00:00.000Z",
            attachments: [],
          },
        ],
      }),
    );
    render(<QuickCaptureOverlay />);

    await screen.findByRole("option", { name: /いつもの定型文/ });
    const pinnedFilter = screen.getByRole("button", {
      name: "ピン留めしたメモ（1件）",
    });
    const allFilter = screen.getByRole("button", {
      name: "未アーカイブのメモ（2件）",
    });

    fireEvent.click(pinnedFilter);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "ピン留めしたメモ（1件）" }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    expect(
      screen.getByRole("option", { name: /いつもの定型文/ }),
    ).toBeVisible();
    expect(
      screen.queryByRole("option", { name: /通常のメモ/ }),
    ).not.toBeInTheDocument();

    fireEvent.click(allFilter);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "未アーカイブのメモ（2件）" }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    expect(screen.getByRole("option", { name: /通常のメモ/ })).toBeVisible();
  });

  it("filters notes with advanced search operators and the attachment filter", async () => {
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
            id: "operator-match",
            content: "レビュー用の添付メモ",
            tags: ["Work"],
            pinned: true,
            createdAt: "2026-07-14T08:00:00.000Z",
            updatedAt: "2026-07-14T08:00:00.000Z",
            attachments: [
              {
                id: "attachment-1",
                fileName: "review.txt",
                mimeType: "text/plain",
                sizeBytes: 12,
                storedPath: "C:/review.txt",
                createdAt: "2026-07-14T08:00:00.000Z",
              },
            ],
          },
          {
            id: "operator-other",
            content: "レビュー用の通常メモ",
            tags: ["work"],
            pinned: false,
            createdAt: "2026-07-14T07:00:00.000Z",
            updatedAt: "2026-07-14T07:00:00.000Z",
            attachments: [],
          },
        ],
      }),
    );
    render(<QuickCaptureOverlay />);

    const search = await screen.findByRole("combobox", {
      name: "保存済みメモを検索",
    });
    await screen.findByRole("option", { name: /レビュー用の通常メモ/ });
    fireEvent.change(search, {
      target: { value: "tag:work is:pinned has:attachment レビュー" },
    });
    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: /レビュー用の添付メモ/ }),
      ).toBeVisible();
      expect(
        screen.queryByRole("option", { name: /レビュー用の通常メモ/ }),
      ).not.toBeInTheDocument();
    });

    fireEvent.change(search, { target: { value: "" } });
    const attachmentFilter = screen.getByRole("button", {
      name: "添付ファイル付きメモ（1件）",
    });
    fireEvent.click(attachmentFilter);
    expect(attachmentFilter).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.queryByRole("option", { name: /レビュー用の通常メモ/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "未アーカイブのメモ（2件）" }),
    );
    expect(attachmentFilter).toHaveAttribute("aria-pressed", "false");
  });

  it("offers existing tags as one-click suggestions", async () => {
    localStorage.setItem(
      "mint_mock_quick_capture",
      JSON.stringify({
        draft: {
          content: "タグを付ける下書き",
          tags: [],
          updatedAt: "2026-07-14T09:00:00.000Z",
        },
        notes: [
          {
            id: "tag-source-note",
            content: "タグ候補の元になるメモ",
            tags: ["work", "idea"],
            pinned: false,
            createdAt: "2026-07-14T08:00:00.000Z",
            updatedAt: "2026-07-14T08:00:00.000Z",
            attachments: [],
          },
        ],
      }),
    );
    render(<QuickCaptureOverlay />);

    const suggestions = await screen.findByRole("group", {
      name: "既存のタグ候補",
    });
    const tags = screen.getByLabelText("タグ");
    const work = within(suggestions).getByRole("button", { name: "#work" });
    const idea = within(suggestions).getByRole("button", { name: "#idea" });

    fireEvent.click(work);
    fireEvent.click(idea);
    expect(tags).toHaveValue("work, idea");
    expect(work).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(work);
    expect(tags).toHaveValue("idea");
  });

  it("keeps archived notes out of the inbox until explicitly requested", async () => {
    localStorage.setItem(
      "mint_mock_quick_capture",
      JSON.stringify({
        draft: { content: "", tags: [], updatedAt: "2026-07-14T09:00:00.000Z" },
        notes: [
          {
            id: "inbox-note",
            content: "受信箱に残るメモ",
            tags: [],
            pinned: false,
            archived: false,
            createdAt: "2026-07-14T08:00:00.000Z",
            updatedAt: "2026-07-14T08:00:00.000Z",
            attachments: [],
          },
          {
            id: "archived-note",
            content: "整理済みのアーカイブメモ",
            tags: [],
            pinned: false,
            archived: true,
            createdAt: "2026-07-14T07:00:00.000Z",
            updatedAt: "2026-07-14T07:00:00.000Z",
            attachments: [],
          },
        ],
      }),
    );
    render(<QuickCaptureOverlay />);

    await screen.findByRole("option", { name: /受信箱に残るメモ/ });
    expect(
      screen.queryByRole("option", { name: /整理済みのアーカイブメモ/ }),
    ).not.toBeInTheDocument();

    const allFilter = screen.getByRole("button", {
      name: "未アーカイブのメモ（1件）",
    });
    expect(allFilter).toHaveAttribute("aria-pressed", "true");
    const archivedFilter = screen.getByRole("button", {
      name: "アーカイブしたメモ（1件）",
    });
    fireEvent.click(archivedFilter);

    await waitFor(() =>
      expect(archivedFilter).toHaveAttribute("aria-pressed", "true"),
    );
    expect(
      screen.getByRole("option", { name: /整理済みのアーカイブメモ/ }),
    ).toBeVisible();
    expect(
      screen.queryByRole("option", { name: /受信箱に残るメモ/ }),
    ).not.toBeInTheDocument();

    fireEvent.click(allFilter);
    await waitFor(() =>
      expect(allFilter).toHaveAttribute("aria-pressed", "true"),
    );
    expect(
      screen.getByRole("option", { name: /受信箱に残るメモ/ }),
    ).toBeVisible();
    expect(
      screen.queryByRole("option", { name: /整理済みのアーカイブメモ/ }),
    ).not.toBeInTheDocument();
  });

  it("offers an archive shortcut when the inbox is empty", async () => {
    localStorage.setItem(
      "mint_mock_quick_capture",
      JSON.stringify({
        draft: { content: "", tags: [], updatedAt: "2026-07-14T09:00:00.000Z" },
        notes: [
          {
            id: "only-archived-note",
            content: "受信箱から整理したメモ",
            tags: [],
            pinned: false,
            archived: true,
            createdAt: "2026-07-14T08:00:00.000Z",
            updatedAt: "2026-07-14T08:00:00.000Z",
            attachments: [],
          },
        ],
      }),
    );
    render(<QuickCaptureOverlay />);

    expect(await screen.findByText("受信箱は空です")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "アーカイブを表示" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "アーカイブしたメモ（1件）" }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    expect(
      await screen.findByRole("option", { name: /受信箱から整理したメモ/ }),
    ).toBeVisible();
  });

  it("saves the current draft with the explicit save shortcut", async () => {
    render(<QuickCaptureOverlay />);
    const editor = await screen.findByLabelText("メモ本文");
    fireEvent.change(editor, {
      target: { value: "ショートカットで保存する下書き" },
    });

    fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "s",
      ctrlKey: true,
    });

    await waitFor(() => {
      const stored = localStorage.getItem("mint_mock_quick_capture");
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored ?? "{}").draft.content).toBe(
        "ショートカットで保存する下書き",
      );
      expect(screen.getByRole("status")).toHaveTextContent("保存済み");
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
    expect(dialog).toHaveTextContent("添付ファイルも保持され");
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

  it("focuses the library search and opens notes with Ctrl+F", async () => {
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
    expect(search).toHaveAttribute(
      "aria-keyshortcuts",
      "Control+F / ArrowDown ArrowUp Home End PageUp PageDown Enter Escape",
    );

    const noteList = within(
      screen.getByRole("listbox", { name: "保存済みメモ" }),
    );
    const options = noteList.getAllByRole("option");
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

  it("moves through a long note list with PageUp and PageDown", async () => {
    localStorage.setItem(
      "mint_mock_quick_capture",
      JSON.stringify({
        draft: {
          content: "編集中の下書き",
          tags: [],
          updatedAt: "2026-07-14T09:00:00.000Z",
        },
        notes: Array.from({ length: 8 }, (_, index) => ({
          id: `page-note-${index}`,
          content: `ページ移動メモ${index + 1}`,
          tags: [],
          pinned: false,
          createdAt: `2026-07-${String(14 - index).padStart(2, "0")}T08:00:00.000Z`,
          updatedAt: `2026-07-${String(14 - index).padStart(2, "0")}T08:00:00.000Z`,
          attachments: [],
        })),
      }),
    );
    render(<QuickCaptureOverlay />);

    const editor = await screen.findByLabelText("メモ本文");
    await screen.findByRole("option", { name: /ページ移動メモ1/ });
    fireEvent.keyDown(editor, { key: "f", ctrlKey: true });

    const search = screen.getByRole("combobox", {
      name: "保存済みメモを検索",
    });
    const noteList = within(
      screen.getByRole("listbox", { name: "保存済みメモ" }),
    );
    const options = noteList.getAllByRole("option");
    expect(options).toHaveLength(8);
    expect(search).toHaveAttribute(
      "aria-keyshortcuts",
      "Control+F / ArrowDown ArrowUp Home End PageUp PageDown Enter Escape",
    );
    expect(screen.getByText("Ctrl F")).toBeInTheDocument();

    fireEvent.keyDown(search, { key: "PageDown" });
    expect(search).toHaveAttribute("aria-activedescendant", options[5].id);
    fireEvent.keyDown(search, { key: "PageUp" });
    expect(search).toHaveAttribute("aria-activedescendant", options[0].id);
  });

  it("sorts notes and explains matching search results", async () => {
    localStorage.setItem(
      "mint_mock_quick_capture",
      JSON.stringify({
        draft: { content: "", tags: [], updatedAt: "2026-07-14T09:00:00.000Z" },
        notes: [
          {
            id: "zeta-note",
            content: "Zetaメモ\nあとで確認する内容",
            tags: [],
            pinned: false,
            archived: false,
            createdAt: "2026-07-14T08:00:00.000Z",
            updatedAt: "2026-07-14T09:00:00.000Z",
            attachments: [],
          },
          {
            id: "alpha-note",
            content: "Alphaメモ\n本文に検索キーワードがあります",
            tags: [],
            pinned: false,
            archived: false,
            createdAt: "2026-07-14T08:30:00.000Z",
            updatedAt: "2026-07-14T08:30:00.000Z",
            attachments: [],
          },
        ],
      }),
    );
    render(<QuickCaptureOverlay />);

    const sortSelect = screen.getByRole("combobox", {
      name: "メモの並び順",
    });
    await screen.findByRole("option", { name: /Alphaメモ/ });
    expect(sortSelect).toHaveValue("updated");
    fireEvent.change(sortSelect, { target: { value: "title" } });

    const noteList = within(
      screen.getByRole("listbox", { name: "保存済みメモ" }),
    );
    const sortedOptions = noteList.getAllByRole("option");
    expect(sortedOptions[0]).toHaveTextContent("Alphaメモ");
    expect(sortedOptions[1]).toHaveTextContent("Zetaメモ");

    const search = screen.getByRole("combobox", {
      name: "保存済みメモを検索",
    });
    fireEvent.change(search, { target: { value: "検索キーワード" } });

    await waitFor(() => {
      expect(noteList.getAllByRole("option")).toHaveLength(1);
      expect(screen.getByText("関連度順")).toBeVisible();
    });
    expect(sortSelect).toBeDisabled();
    expect(
      screen.getByText("検索キーワード", { selector: "mark" }),
    ).toBeInTheDocument();
  });

  it("opens the command palette with Ctrl+K and executes the selected command", async () => {
    render(<QuickCaptureOverlay />);
    const editor = await screen.findByLabelText("メモ本文");

    fireEvent.keyDown(editor, { key: "k", ctrlKey: true });

    const palette = await screen.findByRole("dialog", {
      name: "コマンドパレット",
    });
    const search = within(palette).getByRole("combobox", {
      name: "コマンドを検索",
    });
    await waitFor(() => expect(search).toHaveFocus());
    expect(within(palette).getByText("Ctrl K")).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "プレビュー" } });
    const previewCommand = within(palette).getByRole("option", {
      name: /プレビューを表示/,
    });
    expect(previewCommand).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(search, { key: "Enter" });

    await waitFor(() => expect(palette).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "プレビュー" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("moves from the command palette to library search", async () => {
    render(<QuickCaptureOverlay />);
    const editor = await screen.findByLabelText("メモ本文");

    fireEvent.keyDown(editor, { key: "k", ctrlKey: true });
    const palette = await screen.findByRole("dialog", {
      name: "コマンドパレット",
    });
    const commandSearch = within(palette).getByRole("combobox", {
      name: "コマンドを検索",
    });
    await waitFor(() => expect(commandSearch).toHaveFocus());
    fireEvent.change(commandSearch, {
      target: { value: "保存済みメモを検索" },
    });
    fireEvent.keyDown(commandSearch, { key: "Enter" });

    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "保存済みメモを検索" }),
      ).toHaveFocus(),
    );
    expect(palette).not.toBeInTheDocument();
  });

  it("duplicates the active note from the command palette", async () => {
    render(<QuickCaptureOverlay />);
    const editor = await screen.findByLabelText("メモ本文");
    fireEvent.change(editor, { target: { value: "パレットから複製するメモ" } });
    fireEvent.click(screen.getByRole("button", { name: /メモに保存/ }));
    const savedNote = await screen.findByRole("option", {
      name: /パレットから複製するメモ/,
    });
    fireEvent.click(savedNote);

    fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "k",
      ctrlKey: true,
    });
    const palette = await screen.findByRole("dialog", {
      name: "コマンドパレット",
    });
    const search = within(palette).getByRole("combobox", {
      name: "コマンドを検索",
    });
    fireEvent.change(search, { target: { value: "複製" } });
    fireEvent.keyDown(search, { key: "Enter" });

    await waitFor(() =>
      expect(
        screen.getAllByRole("option", { name: /パレットから複製するメモ/ }),
      ).toHaveLength(2),
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

  it("leaves library search before closing when Escape is pressed again", async () => {
    render(<QuickCaptureOverlay />);

    const search = await screen.findByRole("combobox", {
      name: "保存済みメモを検索",
    });
    const dialog = screen.getByRole("dialog");
    act(() => search.focus());

    fireEvent.keyDown(search, { key: "Escape" });

    expect(search).not.toHaveFocus();
    expect(dialog).toBeInTheDocument();
    expect(windowMocks.hide).not.toHaveBeenCalled();

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(windowMocks.hide).toHaveBeenCalledOnce());
  });

  it("guides an empty library without competing with the editor", async () => {
    render(<QuickCaptureOverlay />);

    expect(
      await screen.findByRole("heading", { name: "クイックキャプチャー" }),
    ).toBeVisible();
    expect(screen.getByPlaceholderText("何を残しておきますか？")).toHaveFocus();
    expect(screen.getByText("まだメモはありません")).toBeVisible();
    expect(
      screen.getByText("Ctrl+Enterで保存すると、ここからすぐ開けます"),
    ).toBeVisible();
  });

  it("shows result metadata only when the library is filtered", async () => {
    localStorage.setItem(
      "mint_mock_quick_capture",
      JSON.stringify({
        draft: { content: "", tags: [], updatedAt: "2026-07-14T09:00:00.000Z" },
        notes: [
          {
            id: "compact-library-note",
            content: "検索対象のメモ",
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

    await screen.findByRole("option", { name: /検索対象のメモ/ });
    const resultMeta = document.querySelector(".quick-capture__search-meta");
    expect(resultMeta).toBeEmptyDOMElement();

    fireEvent.change(
      screen.getByRole("combobox", { name: "保存済みメモを検索" }),
      { target: { value: "検索対象" } },
    );

    await waitFor(() => expect(resultMeta).toHaveTextContent("1件関連度順"));
  });

  it("truncates extremely long note titles without overflowing the header", async () => {
    const longTitleText = `https://github.com/ibukani/iris-mind_v2/issues ${"あ".repeat(100)}`;
    localStorage.setItem(
      "mint_mock_quick_capture",
      JSON.stringify({
        draft: { content: "", tags: [], updatedAt: "2026-07-14T09:00:00.000Z" },
        notes: [
          {
            id: "long-title-note",
            content: longTitleText,
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

    const note = await screen.findByRole("option", {
      name: new RegExp(longTitleText.slice(0, 20)),
    });
    fireEvent.click(note);

    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(longTitleText);
    expect(document.querySelector(".quick-capture__header")).toBeVisible();
    expect(document.querySelector(".quick-capture__library")).toBeVisible();
  });
});
