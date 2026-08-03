import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { noteTitle, QuickCaptureOverlay } from "./QuickCaptureOverlay";

const dialogMocks = vi.hoisted(() => ({
  open: vi.fn(),
  save: vi.fn(),
}));
const windowMocks = vi.hoisted(() => ({
  hide: vi.fn(),
  isVisible: vi.fn(),
  onFocusChanged: vi.fn(),
  onCloseRequested: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: dialogMocks.open,
  save: dialogMocks.save,
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    hide: windowMocks.hide,
    isVisible: windowMocks.isVisible,
    onFocusChanged: windowMocks.onFocusChanged,
    onCloseRequested: windowMocks.onCloseRequested,
  }),
}));

vi.mock("../../../core/context/AppSettings", () => ({
  useSettings: () => undefined,
}));

describe("QuickCaptureOverlay", () => {
  beforeEach(() => {
    localStorage.clear();
    dialogMocks.open.mockReset().mockResolvedValue(null);
    dialogMocks.save.mockReset().mockResolvedValue(null);
    windowMocks.hide.mockReset().mockResolvedValue(undefined);
    windowMocks.isVisible.mockReset().mockResolvedValue(true);
    windowMocks.onFocusChanged.mockReset().mockResolvedValue(() => {});
    windowMocks.onCloseRequested.mockReset().mockResolvedValue(() => {});
  });

  it("opens with the editor focused and keeps the library out of the default layout", async () => {
    render(<QuickCaptureOverlay />);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("メモ本文")).toHaveFocus();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "メモ一覧を開く" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "メモに保存" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "ウィンドウを固定" }),
    ).not.toBeInTheDocument();
  });

  it("opens the library only on demand", async () => {
    render(<QuickCaptureOverlay />);
    const open = await screen.findByRole("button", { name: "メモ一覧を開く" });

    fireEvent.click(open);

    expect(await screen.findByRole("listbox")).toBeVisible();
    await waitFor(() =>
      expect(screen.getByLabelText("保存済みメモを検索")).toHaveFocus(),
    );
    fireEvent.click(screen.getByRole("button", { name: "メモ一覧を閉じる" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("auto-saves input as a note and makes it available in the library", async () => {
    render(<QuickCaptureOverlay />);
    const editor = await screen.findByLabelText("メモ本文");

    fireEvent.change(editor, { target: { value: "自動保存されるメモ" } });
    await waitFor(() =>
      expect(screen.getByText(/保存済み/)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "メモ一覧を開く" }));
    expect(
      await screen.findByRole("option", { name: /自動保存されるメモ/ }),
    ).toBeInTheDocument();
  });

  it("uses Ctrl+F for the current note and Ctrl+Shift+F for the library", async () => {
    render(<QuickCaptureOverlay />);
    const dialog = await screen.findByRole("dialog");
    const editor = screen.getByLabelText("メモ本文");

    fireEvent.change(editor, { target: { value: "alpha beta alpha" } });
    fireEvent.keyDown(dialog, { key: "f", ctrlKey: true });
    const search = await screen.findByLabelText("メモ内を検索");
    await waitFor(() => expect(search).toHaveFocus());

    fireEvent.change(screen.getByLabelText("メモ内を検索"), {
      target: { value: "alpha" },
    });
    expect(screen.getByText("2件")).toBeVisible();

    fireEvent.keyDown(dialog, { key: "f", ctrlKey: true, shiftKey: true });
    expect(await screen.findByRole("listbox")).toBeVisible();
  });

  it("supports replacement from the editor search bar", async () => {
    render(<QuickCaptureOverlay />);
    const dialog = await screen.findByRole("dialog");
    const editor = screen.getByLabelText("メモ本文") as HTMLTextAreaElement;

    fireEvent.change(editor, { target: { value: "alpha beta alpha" } });
    fireEvent.keyDown(dialog, { key: "h", ctrlKey: true });
    fireEvent.change(screen.getByLabelText("メモ内を検索"), {
      target: { value: "alpha" },
    });
    fireEvent.change(screen.getByLabelText("置換後の文字列"), {
      target: { value: "omega" },
    });
    fireEvent.click(screen.getByRole("button", { name: "すべて置換" }));

    expect(editor).toHaveValue("omega beta omega");
  });

  it("derives a title from the first non-empty line", () => {
    expect(noteTitle({ content: "\n  見出し  \n本文" })).toBe("見出し");
  });
});
