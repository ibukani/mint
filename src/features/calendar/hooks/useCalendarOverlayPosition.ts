import { LogicalSize, PhysicalPosition } from "@tauri-apps/api/dpi";
import {
  currentMonitor,
  getCurrentWindow,
  Window,
} from "@tauri-apps/api/window";
import { useEffect } from "react";

const WINDOW_MARGIN = 20;

interface UseCalendarOverlayPositionProps {
  isVisible: boolean;
  clockEnabled: boolean | undefined;
  clockSizePercent: number | undefined;
  clockDisplayMode: "analog" | "digital" | undefined;
  setIsDocked: (docked: boolean) => void;
}

export const useCalendarOverlayPosition = ({
  isVisible,
  clockEnabled,
  clockSizePercent,
  clockDisplayMode,
  setIsDocked,
}: UseCalendarOverlayPositionProps) => {
  useEffect(() => {
    if (
      !isVisible ||
      clockSizePercent === undefined ||
      clockDisplayMode === undefined ||
      clockEnabled === undefined
    ) {
      return;
    }

    const percent = clockSizePercent / 100;
    const baseWidth = clockDisplayMode === "analog" ? 240 : 420;
    const width = Math.max(Math.round(baseWidth * percent), 320);
    const height = Math.round(384 * Math.max(width / 420, 1));
    const currentWindow = getCurrentWindow();
    let cancelled = false;

    const positionWindow = async () => {
      const monitor = await currentMonitor();
      if (!monitor || cancelled) return;
      if (typeof currentWindow.setSize === "function") {
        await currentWindow
          .setSize(new LogicalSize(width, height))
          .catch((error) =>
            console.error("Failed to resize calendar window:", error),
          );
      }
      if (cancelled) return;

      const clockWindow = await Window.getByLabel("clock");
      if (cancelled) return;
      const isClockVisible =
        clockWindow && typeof clockWindow.isVisible === "function"
          ? await clockWindow.isVisible()
          : false;
      if (cancelled) return;
      const docked = clockEnabled && isClockVisible;
      setIsDocked(docked);
      const scaleFactor = monitor.scaleFactor;
      const calendarWidthPhysical = Math.round(width * scaleFactor);

      if (docked && clockWindow) {
        const clockPosition = await clockWindow.outerPosition();
        const clockSize = await clockWindow.outerSize();
        if (cancelled) return;
        await currentWindow
          .setPosition(
            new PhysicalPosition(
              clockPosition.x + clockSize.width - calendarWidthPhysical,
              clockPosition.y + clockSize.height,
            ),
          )
          .catch((error) =>
            console.error(
              "Failed to position calendar window (docked):",
              error,
            ),
          );
      } else {
        const margin = Math.round(WINDOW_MARGIN * scaleFactor);
        if (cancelled) return;
        await currentWindow
          .setPosition(
            new PhysicalPosition(
              monitor.size.width - calendarWidthPhysical - margin,
              margin,
            ),
          )
          .catch((error) =>
            console.error(
              "Failed to position calendar window (undocked):",
              error,
            ),
          );
      }
    };

    void positionWindow().catch((error) => {
      if (!cancelled) console.error("Failed to load monitor details:", error);
    });
    return () => {
      cancelled = true;
    };
  }, [
    clockDisplayMode,
    clockEnabled,
    clockSizePercent,
    isVisible,
    setIsDocked,
  ]);
};
