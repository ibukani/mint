import type React from "react";
import { useCallback, useRef } from "react";
import type { FileShelfItem } from "../types";

const DRAG_THRESHOLD_PX = 6;
const SUPPRESS_CLICK_MS = 750;

interface PendingDrag {
  pointerId: number;
  startX: number;
  startY: number;
  items: FileShelfItem[];
  move: boolean;
  target: HTMLElement;
}

interface FileShelfDragGestureOptions {
  disabled: boolean;
  onDrag: (items: FileShelfItem[], move: boolean) => void | Promise<void>;
}

const draggableItems = (items: FileShelfItem[]) =>
  items.filter(
    (item) => item.availability === "ready" && Boolean(item.sourcePath),
  );

export const useFileShelfDragGesture = ({
  disabled,
  onDrag,
}: FileShelfDragGestureOptions) => {
  const pending = useRef<PendingDrag | null>(null);
  const suppressClickUntil = useRef(0);

  const begin = useCallback(
    (event: React.PointerEvent<HTMLElement>, items: FileShelfItem[]) => {
      if (disabled || event.button !== 0) return;
      const ready = draggableItems(items);
      if (!ready.length) return;

      pending.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        items: ready,
        move: event.shiftKey,
        target: event.currentTarget,
      };
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        // Native drag can take ownership before pointer capture is available.
      }
    },
    [disabled],
  );

  const end = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const gesture = pending.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    pending.current = null;
    try {
      gesture.target.releasePointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture may already be released by the operating system.
    }
  }, []);

  const move = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const gesture = pending.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      const horizontal = event.clientX - gesture.startX;
      const vertical = event.clientY - gesture.startY;
      if (
        horizontal * horizontal + vertical * vertical <
        DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX
      ) {
        return;
      }

      pending.current = null;
      suppressClickUntil.current = performance.now() + SUPPRESS_CLICK_MS;
      try {
        gesture.target.releasePointerCapture?.(event.pointerId);
      } catch {
        // Native drag may release capture as it crosses into another app.
      }
      event.preventDefault();
      void onDrag(gesture.items, gesture.move || event.shiftKey);
    },
    [onDrag],
  );

  const consumeSuppressedClick = useCallback(() => {
    const suppressed =
      suppressClickUntil.current > 0 &&
      performance.now() <= suppressClickUntil.current;
    suppressClickUntil.current = 0;
    return suppressed;
  }, []);

  return { begin, move, end, consumeSuppressedClick };
};
