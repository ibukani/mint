import { fireEvent, render } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWindowDrag } from "./useWindowDrag";

const mocks = vi.hoisted(() => ({
  startDragging: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ startDragging: mocks.startDragging }),
}));

const DragSurface: React.FC = () => {
  const handlers = useWindowDrag();
  return (
    <div data-testid="surface" {...handlers}>
      <span data-testid="empty">空白</span>
      <button type="button">操作</button>
      <p data-window-drag-block>選択可能な本文</p>
    </div>
  );
};

const drag = (
  element: Element,
  distance: number,
  options: { button?: number; ctrlKey?: boolean; pointerType?: string } = {},
) => {
  fireEvent.pointerDown(element, {
    button: options.button ?? 0,
    buttons: 1,
    clientX: 10,
    clientY: 10,
    ctrlKey: options.ctrlKey,
    pointerId: 1,
    pointerType: options.pointerType ?? "mouse",
  });
  fireEvent.pointerMove(element, {
    buttons: 1,
    clientX: 10 + distance,
    clientY: 10,
    pointerId: 1,
    pointerType: options.pointerType ?? "mouse",
  });
};

describe("useWindowDrag", () => {
  beforeEach(() => mocks.startDragging.mockClear());

  it("6px移動したときだけウィンドウドラッグを一度開始する", () => {
    const { getByTestId } = render(<DragSurface />);
    const empty = getByTestId("empty");
    drag(empty, 5);
    expect(mocks.startDragging).not.toHaveBeenCalled();
    fireEvent.pointerMove(empty, {
      buttons: 1,
      clientX: 16,
      clientY: 10,
      pointerId: 1,
      pointerType: "mouse",
    });
    fireEvent.pointerMove(empty, {
      buttons: 1,
      clientX: 30,
      clientY: 10,
      pointerId: 1,
      pointerType: "mouse",
    });
    expect(mocks.startDragging).toHaveBeenCalledOnce();
  });

  it.each([
    ["button", "button"],
    ["明示的な除外本文", "[data-window-drag-block]"],
  ])("%sではドラッグを開始しない", (_label, selector) => {
    const { container } = render(<DragSurface />);
    const target = container.querySelector(selector);
    if (!target) throw new Error("test target is missing");
    drag(target, 20);
    expect(mocks.startDragging).not.toHaveBeenCalled();
  });

  it("右クリック、修飾キー、タッチ操作を除外する", () => {
    const { getByTestId } = render(<DragSurface />);
    const empty = getByTestId("empty");
    drag(empty, 20, { button: 2 });
    drag(empty, 20, { ctrlKey: true });
    drag(empty, 20, { pointerType: "touch" });
    expect(mocks.startDragging).not.toHaveBeenCalled();
  });

  it("pointer upまたはcancel後は古い候補を使わない", () => {
    const { getByTestId } = render(<DragSurface />);
    const empty = getByTestId("empty");
    fireEvent.pointerDown(empty, {
      button: 0,
      buttons: 1,
      clientX: 10,
      clientY: 10,
      pointerId: 1,
      pointerType: "mouse",
    });
    fireEvent.pointerUp(empty, { pointerId: 1, pointerType: "mouse" });
    fireEvent.pointerMove(empty, {
      buttons: 1,
      clientX: 30,
      clientY: 10,
      pointerId: 1,
      pointerType: "mouse",
    });
    fireEvent.pointerCancel(empty, { pointerId: 1, pointerType: "mouse" });
    expect(mocks.startDragging).not.toHaveBeenCalled();
  });
});
