import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorToast } from "./ErrorToast";

describe("ErrorToast", () => {
  it("renders an accessible alert with a dismiss button", () => {
    const onDismiss = vi.fn();

    render(
      <ErrorToast message="設定の保存に失敗しました" onDismiss={onDismiss} />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "設定の保存に失敗しました",
    );

    fireEvent.click(screen.getByRole("button", { name: "エラー通知を閉じる" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("dismisses the alert with Escape", () => {
    const onDismiss = vi.fn();

    render(
      <ErrorToast message="設定の保存に失敗しました" onDismiss={onDismiss} />,
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
