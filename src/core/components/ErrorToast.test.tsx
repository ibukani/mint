import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorToast } from "./ErrorToast";

describe("ErrorToast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders an accessible alert with a dismiss button", () => {
    const onDismiss = vi.fn();

    render(
      <ErrorToast message="設定の保存に失敗しました" onDismiss={onDismiss} />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "設定の保存に失敗しました",
    );
    expect(screen.getByText("Esc でも閉じられます。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "エラー通知を閉じる" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("focuses the dismiss button when shown", () => {
    const onDismiss = vi.fn();

    render(
      <ErrorToast message="設定の保存に失敗しました" onDismiss={onDismiss} />,
    );

    expect(
      screen.getByRole("button", { name: "エラー通知を閉じる" }),
    ).toHaveFocus();
  });

  it("restores focus to the previously active element when dismissed", () => {
    const onDismiss = vi.fn();

    const { rerender } = render(
      <div>
        <button type="button">元のボタン</button>
        <ErrorToast message={null} onDismiss={onDismiss} />
      </div>,
    );

    screen.getByRole("button", { name: "元のボタン" }).focus();

    rerender(
      <div>
        <button type="button">元のボタン</button>
        <ErrorToast message="設定の保存に失敗しました" onDismiss={onDismiss} />
      </div>,
    );

    expect(
      screen.getByRole("button", { name: "エラー通知を閉じる" }),
    ).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "エラー通知を閉じる" }));
    rerender(
      <div>
        <button type="button">元のボタン</button>
        <ErrorToast message={null} onDismiss={onDismiss} />
      </div>,
    );

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "元のボタン" })).toHaveFocus();
  });

  it("dismisses the alert with Escape", () => {
    const onDismiss = vi.fn();

    render(
      <ErrorToast message="設定の保存に失敗しました" onDismiss={onDismiss} />,
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("keeps the toast visible while hovered and dismisses after leaving", async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();

    render(
      <ErrorToast message="設定の保存に失敗しました" onDismiss={onDismiss} />,
    );

    fireEvent.mouseEnter(screen.getByRole("alert"));

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.mouseLeave(screen.getByRole("alert"));

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
