import { emitTo, listen } from "@tauri-apps/api/event";
import {
  currentMonitor,
  getCurrentWindow,
  LogicalPosition,
  Window,
} from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppSettings } from "../../../core/context/AppSettings";

const ANIMATION_MS = 240;
const CALENDAR_WIDTH = 420;
const WINDOW_MARGIN = 20;

interface CalendarShownPayload {
  closeClockOnToggle: boolean;
  docked: boolean;
}

export const useCalendarOverlay = () => {
  const { settings } = useAppSettings();
  const [isVisible, setIsVisible] = useState(true);
  const [isHiding, setIsHiding] = useState(false);
  const [isDocked, setIsDocked] = useState(false);
  const [showSequence, setShowSequence] = useState(0);
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

  const closeCalendar = useCallback((hideClock: boolean) => {
    if (closingRef.current) return;
    closingRef.current = true;
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
          .then(() => emitTo("clock", "calendar-closed"))
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
  }, []);

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
        setIsHiding(false);
        setIsVisible(false);
        setShowSequence((current) => current + 1);
        requestAnimationFrame(() => setIsVisible(true));
      },
    );
    const hidePromise = listen("calendar-hide-requested", () => {
      closeCalendar(closeClockOnToggleRef.current);
    });
    const hideAllPromise = listen("calendar-hide-all-requested", () => {
      closeCalendar(true);
    });

    return () => {
      void shownPromise.then((unlisten) => unlisten());
      void hidePromise.then((unlisten) => unlisten());
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
    if (settings && !settings.calendar.enabled) {
      closeCalendar(closeClockOnToggleRef.current);
    }
  }, [settings, closeCalendar]);

  useEffect(() => {
    if (settings?.clock.enabled !== false || !isDocked) return;

    currentMonitor()
      .then((monitor) => {
        if (!monitor) return;
        const monitorWidth = monitor.size.width / monitor.scaleFactor;
        return getCurrentWindow().setPosition(
          new LogicalPosition(
            monitorWidth - CALENDAR_WIDTH - WINDOW_MARGIN,
            WINDOW_MARGIN,
          ),
        );
      })
      .then(() => setIsDocked(false))
      .catch((error) =>
        console.error("Failed to reposition calendar overlay:", error),
      );
  }, [settings?.clock.enabled, isDocked]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCalendar(true);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeCalendar]);

  const animationClass = isHiding ? "is-hiding" : isVisible ? "is-visible" : "";

  return {
    animationClass,
    closeCalendar: () => closeCalendar(true),
    isDocked,
    showSequence,
  };
};
