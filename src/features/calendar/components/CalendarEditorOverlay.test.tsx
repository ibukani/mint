import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSettings } from "../../../core/mocks/mockSettings";
import { CalendarEditorOverlay } from "./CalendarEditorOverlay";

const mocks = vi.hoisted(() => ({
  emit: vi.fn().mockResolvedValue(undefined),
  hide: vi.fn().mockResolvedValue(undefined),
  invoke: vi.fn().mockResolvedValue(null),
  listeners: new Map<string, (event: { payload: unknown }) => void>(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
}));

vi.mock("@tauri-apps/api/event", () => ({
  emit: mocks.emit,
  listen: vi.fn(
    async (event: string, callback: (event: { payload: unknown }) => void) => {
      mocks.listeners.set(event, callback);
      return () => mocks.listeners.delete(event);
    },
  ),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    hide: mocks.hide,
    startDragging: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../../../core/context/AppSettings", () => ({
  useAppSettings: () => ({ settings: createMockSettings() }),
}));

describe("CalendarEditorOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listeners.clear();
    mocks.hide.mockReset().mockResolvedValue(undefined);
    mocks.invoke.mockReset().mockResolvedValue(null);
  });

  it("keeps unsaved input until the user explicitly discards it", async () => {
    let finishHide: () => void = () => undefined;
    mocks.hide.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishHide = resolve;
        }),
    );
    render(<CalendarEditorOverlay />);

    const title = await screen.findByLabelText("タイトル");
    fireEvent.change(title, { target: { value: "未保存の予定" } });
    const close = screen.getByRole("button", { name: "エディタを閉じる" });
    close.focus();
    fireEvent.click(close);

    const dialog = screen.getByRole("alertdialog", {
      name: "未保存の変更を破棄しますか？",
    });
    expect(mocks.hide).not.toHaveBeenCalled();
    expect(
      within(dialog).getByRole("button", { name: "キャンセル" }),
    ).toHaveFocus();
    fireEvent.click(within(dialog).getByRole("button", { name: "キャンセル" }));
    expect(title).toHaveValue("未保存の予定");
    expect(close).toHaveFocus();

    fireEvent.click(close);
    fireEvent.click(screen.getByRole("button", { name: "破棄して閉じる" }));
    expect(
      screen.getByRole("button", { name: "閉じています…" }),
    ).toBeDisabled();
    expect(mocks.hide).toHaveBeenCalledOnce();

    await act(async () => finishHide());
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it("keeps close failures in the dialog and allows retry", async () => {
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    mocks.hide
      .mockRejectedValueOnce(new Error("window unavailable"))
      .mockResolvedValueOnce(undefined);
    render(<CalendarEditorOverlay />);

    fireEvent.change(await screen.findByLabelText("タイトル"), {
      target: { value: "未保存の予定" },
    });
    fireEvent.click(screen.getByRole("button", { name: "エディタを閉じる" }));
    fireEvent.click(screen.getByRole("button", { name: "破棄して閉じる" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "予定入力画面を閉じられませんでした",
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "破棄して閉じる" }),
    ).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "破棄して閉じる" }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(mocks.hide).toHaveBeenCalledTimes(2);
    expect(consoleWarn).toHaveBeenCalledWith(
      "Failed to hide calendar editor window",
      expect.any(Error),
    );
    consoleWarn.mockRestore();
  });

  it("closes immediately when the editor has no changes", async () => {
    render(<CalendarEditorOverlay />);

    await screen.findByLabelText("タイトル");
    fireEvent.click(screen.getByRole("button", { name: "エディタを閉じる" }));

    await waitFor(() => expect(mocks.hide).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
