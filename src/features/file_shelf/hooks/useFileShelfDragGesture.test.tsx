import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FileShelfItem } from "../types";
import { useFileShelfDragGesture } from "./useFileShelfDragGesture";

const fileItem: FileShelfItem = {
  id: "file",
  groupId: "group",
  kind: "file",
  displayName: "report.pdf",
  sourcePath: "C:\\Work\\report.pdf",
  textContent: null,
  mimeType: null,
  sizeBytes: 1024,
  createdAt: "2026-07-15T00:00:00Z",
  availability: "ready",
  source: "manual",
  pinned: false,
};

const textItem: FileShelfItem = {
  ...fileItem,
  id: "text",
  kind: "text",
  displayName: "メモ",
  sourcePath: null,
  textContent: "copy me",
};

const Harness = ({
  item = fileItem,
  onClick,
  onDrag,
}: {
  item?: FileShelfItem;
  onClick: () => void;
  onDrag: (items: FileShelfItem[], move: boolean) => void;
}) => {
  const gesture = useFileShelfDragGesture({ disabled: false, onDrag });
  return (
    <button
      type="button"
      onPointerDown={(event) => gesture.begin(event, [item])}
      onPointerMove={gesture.move}
      onPointerUp={gesture.end}
      onPointerCancel={gesture.end}
      onClick={() => {
        if (!gesture.consumeSuppressedClick()) onClick();
      }}
    >
      item
    </button>
  );
};

describe("useFileShelfDragGesture", () => {
  it("keeps short pointer movement as a normal click", () => {
    const onClick = vi.fn();
    const onDrag = vi.fn();
    render(<Harness onClick={onClick} onDrag={onDrag} />);
    const row = screen.getByRole("button", { name: "item" });

    fireEvent.pointerDown(row, {
      button: 0,
      pointerId: 1,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerMove(row, { pointerId: 1, clientX: 14, clientY: 13 });
    fireEvent.pointerUp(row, { pointerId: 1 });
    fireEvent.click(row);

    expect(onDrag).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("starts a row drag after six pixels and suppresses its trailing click", () => {
    const onClick = vi.fn();
    const onDrag = vi.fn();
    render(<Harness onClick={onClick} onDrag={onDrag} />);
    const row = screen.getByRole("button", { name: "item" });

    fireEvent.pointerDown(row, {
      button: 0,
      pointerId: 2,
      clientX: 20,
      clientY: 20,
      shiftKey: true,
    });
    fireEvent.pointerMove(row, { pointerId: 2, clientX: 26, clientY: 20 });
    fireEvent.click(row);

    expect(onDrag).toHaveBeenCalledWith([fileItem], true);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not start an outward drag for text-only shelf content", () => {
    const onClick = vi.fn();
    const onDrag = vi.fn();
    render(<Harness item={textItem} onClick={onClick} onDrag={onDrag} />);
    const row = screen.getByRole("button", { name: "item" });

    fireEvent.pointerDown(row, {
      button: 0,
      pointerId: 3,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(row, { pointerId: 3, clientX: 20, clientY: 0 });
    fireEvent.click(row);

    expect(onDrag).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledOnce();
  });
});
