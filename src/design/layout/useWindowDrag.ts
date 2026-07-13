import { getCurrentWindow } from "@tauri-apps/api/window";
import type React from "react";
import { useCallback, useRef } from "react";

const DRAG_THRESHOLD_PX = 6;
const BLOCKED_TARGETS = [
  "button",
  "a[href]",
  "input",
  "select",
  "textarea",
  "label",
  "[contenteditable='true']",
  "[draggable='true']",
  "[role='button']",
  "[role='link']",
  "[role='checkbox']",
  "[role='menuitem']",
  "[role='option']",
  "[role='slider']",
  "[role='switch']",
  "[data-window-drag-block]",
].join(",");

interface DragCandidate {
  pointerId: number;
  x: number;
  y: number;
}

const canStartWindowDrag = (event: React.PointerEvent<HTMLElement>) => {
  if (
    event.pointerType !== "mouse" ||
    event.button !== 0 ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  ) {
    return false;
  }
  return (
    event.target instanceof Element && !event.target.closest(BLOCKED_TARGETS)
  );
};

export const useWindowDrag = () => {
  const candidateRef = useRef<DragCandidate | null>(null);

  const cancelCandidate = useCallback(() => {
    candidateRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      cancelCandidate();
      if (!canStartWindowDrag(event)) return;
      candidateRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
    },
    [cancelCandidate],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const candidate = candidateRef.current;
      if (!candidate || candidate.pointerId !== event.pointerId) return;
      if ((event.buttons & 1) === 0) {
        cancelCandidate();
        return;
      }
      const distance = Math.hypot(
        event.clientX - candidate.x,
        event.clientY - candidate.y,
      );
      if (distance < DRAG_THRESHOLD_PX) return;

      cancelCandidate();
      event.preventDefault();
      const currentWindow = getCurrentWindow();
      if (typeof currentWindow.startDragging !== "function") return;
      void currentWindow
        .startDragging()
        .catch((error) =>
          console.warn("Failed to start dragging window:", error),
        );
    },
    [cancelCandidate],
  );

  return {
    onPointerCancel: cancelCandidate,
    onPointerDown,
    onPointerLeave: cancelCandidate,
    onPointerMove,
    onPointerUp: cancelCandidate,
  };
};
