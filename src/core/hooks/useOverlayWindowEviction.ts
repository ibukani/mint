import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef } from "react";

// Keep recently used overlays warm, but do not retain a WebView forever after
// the user has stopped using it. This is intentionally a grace period: the
// first reopen inside the period stays fast, while long idle sessions release
// the auxiliary WebView and its renderer process.
export const OVERLAY_IDLE_EVICTION_MS = 2 * 60 * 1000;

interface OverlayWindowEvictionOptions {
  enabled?: boolean;
  delayMs?: number;
}

export const useOverlayWindowEviction = (
  isVisible: boolean,
  {
    enabled = true,
    delayMs = OVERLAY_IDLE_EVICTION_MS,
  }: OverlayWindowEvictionOptions = {},
) => {
  const isVisibleRef = useRef(isVisible);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (isVisible || !enabled) return;

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (isVisibleRef.current) return;

      const currentWindow = getCurrentWindow();
      if (
        typeof currentWindow.isVisible !== "function" ||
        typeof currentWindow.destroy !== "function"
      ) {
        return;
      }

      void currentWindow
        .isVisible()
        .then((visible) => {
          if (visible || isVisibleRef.current) return;
          return currentWindow.destroy();
        })
        .catch((error) => {
          console.warn("Failed to evict idle overlay window", error);
        });
    }, delayMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [delayMs, enabled, isVisible]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );
};
