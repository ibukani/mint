import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

const DialogFixture = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        削除を開始
      </button>
      <ConfirmDialog
        open={open}
        title="メモを削除しますか？"
        description="この操作は取り消せません。"
        confirmLabel="削除する"
        onCancel={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
      />
    </>
  );
};

describe("ConfirmDialog", () => {
  it("focuses the safe action, traps focus, and restores the trigger", async () => {
    render(<DialogFixture />);
    const trigger = screen.getByRole("button", { name: "削除を開始" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("alertdialog", {
      name: "メモを削除しますか？",
    });
    const cancel = screen.getByRole("button", { name: "キャンセル" });
    const confirm = screen.getByRole("button", { name: "削除する" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveTextContent("この操作は取り消せません。");
    expect(cancel).toHaveFocus();
    expect(confirm).toHaveClass("design-button--danger");
    expect(trigger.parentElement).toHaveAttribute("inert");
    expect(trigger.parentElement).toHaveAttribute("aria-hidden", "true");

    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(confirm).toHaveFocus();
    fireEvent.keyDown(confirm, { key: "Tab" });
    expect(cancel).toHaveFocus();

    fireEvent.keyDown(cancel, { key: "Escape" });
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(trigger.parentElement).not.toHaveAttribute("inert");
    expect(trigger.parentElement).not.toHaveAttribute("aria-hidden");
  });

  it("blocks dismissal while an operation is running and announces errors", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="バックアップを復元しますか？"
        description="現在の内容を置き換えます。"
        confirmLabel="復元する"
        busy
        busyLabel="復元しています…"
        error="バックアップを読み込めませんでした。"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "バックアップを読み込めませんでした。",
    );
    expect(
      screen.getByRole("button", { name: "復元しています…" }),
    ).toBeDisabled();

    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement as HTMLElement);
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("contains keyboard events so overlay shortcuts do not run underneath", () => {
    const windowKeyDown = vi.fn();
    window.addEventListener("keydown", windowKeyDown);
    render(
      <ConfirmDialog
        open
        title="予定を削除しますか？"
        description="この操作は取り消せません。"
        confirmLabel="削除する"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    fireEvent.keyDown(screen.getByRole("button", { name: "キャンセル" }), {
      key: "e",
    });
    expect(windowKeyDown).not.toHaveBeenCalled();
    window.removeEventListener("keydown", windowKeyDown);
  });
});
