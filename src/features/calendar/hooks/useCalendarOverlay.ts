import { LogicalSize, PhysicalPosition } from "@tauri-apps/api/dpi";
import { emitTo, listen } from "@tauri-apps/api/event";
import {
  currentMonitor,
  getCurrentWindow,
  Window,
} from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppSettings } from "../../../core/context/AppSettings";
import { defaultAppSettings } from "../../../core/defaultSettings";
import { useOverlayWindowEviction } from "../../../core/hooks/useOverlayWindowEviction";
import type { CalendarOpenMode } from "../types";

const ANIMATION_MS = 240;
const WINDOW_MARGIN = 20;

interface CalendarShownPayload {
  closeClockOnToggle: boolean;
  docked: boolean;
  initialMode: CalendarOpenMode;
}

export const useCalendarOverlay = (canClose: () => boolean) => {
  const { settings } = useAppSettings();
  const calendarEnabled = settings?.calendar.enabled;
  const clockEnabled = settings?.clock.enabled;
  const clockSizePercent = settings?.clock.sizePercent;
  const clockDisplayMode = settings?.clock.displayMode;
  const [isVisible, setIsVisible] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  const [isDocked, setIsDocked] = useState(false);
  const [showSequence, setShowSequence] = useState(0);
  const [openMode, setOpenMode] = useState<CalendarOpenMode>("month");
  const isVisibleRef = useRef(false);
  const closeClockOnToggleRef = useRef(false);
  const closingRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.body.classList.add("is-overlay");
    document.documentElement.classList.add("is-overlay");
    return () => {
      document.body.classList.remove("is-overlay");
      document.documentElement.classList.remove("is-overlay");
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const currentWindow = getCurrentWindow();
    if (typeof currentWindow.isVisible !== "function") {
      isVisibleRef.current = true;
      setIsVisible(true);
      return () => {
        mounted = false;
      };
    }

    void currentWindow
      .isVisible()
      .then((visible) => {
        if (mounted && visible) {
          isVisibleRef.current = true;
          setIsVisible(true);
        }
      })
      .catch(() => {
        if (mounted) {
          isVisibleRef.current = true;
          setIsVisible(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const closeCalendar = useCallback(
    (hideClock: boolean) => {
      if (!canClose()) return;
      if (closingRef.current) return;
      closingRef.current = true;
      isVisibleRef.current = false;
      setIsVisible(false);
      setIsHiding(true);

      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      const reduceMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      hideTimerRef.current = setTimeout(
        () => {
          const currentWindow = getCurrentWindow();
          Promise.all([
            currentWindow.hide(),
            hideClock
              ? Window.getByLabel("clock").then((clockWindow) =>
                  clockWindow?.hide(),
                )
              : Promise.resolve(),
          ])
            .then(() => emitTo("clock", "calendar-closed", { hideClock }))
            .catch((error) =>
              console.error("Failed to hide calendar overlay:", error),
            )
            .finally(() => {
              setIsHiding(false);
              closingRef.current = false;
              hideTimerRef.current = null;
            });
        },
        reduceMotion ? 0 : ANIMATION_MS,
      );
    },
    [canClose],
  );

  useEffect(() => {
    const shownPromise = listen<CalendarShownPayload>(
      "calendar-shown",
      ({ payload }) => {
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
          hideTimerRef.current = null;
        }
        closingRef.current = false;
        closeClockOnToggleRef.current = payload.closeClockOnToggle;
        setIsDocked(payload.docked);
        setOpenMode(payload.initialMode ?? "month");
        setIsHiding(false);
        setShowSequence((current) => current + 1);
        isVisibleRef.current = true;
        setIsVisible(true);
      },
    );
    const hidePromise = listen("calendar-hide-requested", () => {
      closeCalendar(closeClockOnToggleRef.current);
    });
    const createPromise = listen("calendar-create-requested", () => {
      setOpenMode("createEvent");
      setShowSequence((current) => current + 1);
    });
    const hideAllPromise = listen("calendar-hide-all-requested", () => {
      closeCalendar(true);
    });

    return () => {
      void shownPromise.then((unlisten) => unlisten());
      void hidePromise.then((unlisten) => unlisten());
      void createPromise.then((unlisten) => unlisten());
      void hideAllPromise.then((unlisten) => unlisten());
    };
  }, [closeCalendar]);

  useEffect(
    () => () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (calendarEnabled === false) {
      closeCalendar(closeClockOnToggleRef.current);
    }
  }, [calendarEnabled, closeCalendar]);

  useOverlayWindowEviction(isVisible);

  // Resize and position the window from the frontend
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
    const baseW = clockDisplayMode === "analog" ? 240 : 420;
    const contentWidth = Math.max(Math.round(baseW * percent), 320);
    const width = contentWidth;
    const height = Math.round(384 * Math.max(contentWidth / 420, 1.0));

    const window = getCurrentWindow();

    currentMonitor()
      .then(async (monitor) => {
        if (!monitor) return;

        // 1. Resize the window first
        if (typeof window.setSize === "function") {
          await window
            .setSize(new LogicalSize(width, height))
            .catch((error) => {
              console.error("Failed to resize calendar window:", error);
            });
        }

        // 2. Position the window
        const clockWindow = await Window.getByLabel("clock");
        const isClockVisible =
          clockWindow && typeof clockWindow.isVisible === "function"
            ? await clockWindow.isVisible()
            : false;
        const docked = clockEnabled && isClockVisible;
        setIsDocked(docked);

        if (docked && clockWindow) {
          const clockPosition = await clockWindow.outerPosition();
          const clockSize = await clockWindow.outerSize();
          const scaleFactor = monitor.scaleFactor;

          const calendarWidthPhysical = Math.round(width * scaleFactor);
          const padding = 0;

          const x = clockPosition.x + clockSize.width - calendarWidthPhysical;
          const y = clockPosition.y + clockSize.height - padding;

          await window
            .setPosition(new PhysicalPosition(x, y))
            .catch((error) => {
              console.error(
                "Failed to position calendar window (docked):",
                error,
              );
            });
        } else {
          // Not docked, position at top-right
          const scaleFactor = monitor.scaleFactor;
          const calendarWidthPhysical = Math.round(width * scaleFactor);
          const margin = Math.round(WINDOW_MARGIN * scaleFactor);

          const x = monitor.size.width - calendarWidthPhysical - margin;
          const y = margin;

          await window
            .setPosition(new PhysicalPosition(x, y))
            .catch((error) => {
              console.error(
                "Failed to position calendar window (undocked):",
                error,
              );
            });
        }
      })
      .catch((error) => {
        console.error("Failed to load monitor details:", error);
      });
  }, [clockDisplayMode, clockEnabled, clockSizePercent, isVisible]);

  const animationClass = isHiding ? "is-hiding" : isVisible ? "is-visible" : "";
  const themeColor =
    settings?.calendar.themeColor ?? defaultAppSettings.calendar.themeColor;

  return {
    animationClass,
    closeCalendar: () => closeCalendar(true),
    isDocked,
    isVisible,
    openMode,
    selectedGoogleCalendarIds:
      settings?.calendar.selectedGoogleCalendarIds ?? null,
    showSequence,
    themeColor,
  };
};
