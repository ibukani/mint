import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppSettings } from "../../../core/context/AppSettings";
import { defaultAppSettings } from "../../../core/defaultSettings";
import { useOverlayWindowEviction } from "../../../core/hooks/useOverlayWindowEviction";

const HIDE_ANIMATION_MS = 280;

export const useClockOverlay = () => {
  const { settings } = useAppSettings();
  const clockEnabled = settings?.clock.enabled;
  const autoHideSeconds = settings?.clock.autoHideSeconds;
  const [isAnimateVisible, setIsAnimateVisible] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [showSequence, setShowSequence] = useState(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsAnimateVisible(true);
    setIsHiding(false);
    document.body.classList.add("is-overlay");
    document.documentElement.classList.add("is-overlay");

    return () => {
      document.body.classList.remove("is-overlay");
      document.documentElement.classList.remove("is-overlay");
    };
  }, []);

  useOverlayWindowEviction(isAnimateVisible);

  const hideClock = useCallback(() => {
    setIsAnimateVisible(false);
    setIsHiding(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);

    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    hideTimerRef.current = setTimeout(
      () => {
        getCurrentWindow()
          .hide()
          .then(() => {
            setIsHiding(false);
            hideTimerRef.current = null;
          })
          .catch((error) => {
            console.error("Failed to hide clock window:", error);
            setIsHiding(false);
            hideTimerRef.current = null;
          });
      },
      reduceMotion ? 0 : HIDE_ANIMATION_MS,
    );
  }, []);

  useEffect(
    () => () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (clockEnabled === false) {
      setIsAnimateVisible(false);
      setIsHiding(false);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      getCurrentWindow()
        .hide()
        .catch((error) => console.error("Failed to hide clock window:", error));
    }
  }, [clockEnabled]);

  useEffect(() => {
    const unlistenPromise = listen("clock-shown", () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      setIsAnimateVisible(true);
      setIsHiding(false);
      setIsCalendarOpen(false);
      setShowSequence((current) => current + 1);
    });
    const calendarOpenedPromise = listen("calendar-opened", () => {
      setIsCalendarOpen(true);
    });
    const calendarClosedPromise = listen<{ hideClock?: boolean }>(
      "calendar-closed",
      ({ payload }) => {
        if (payload?.hideClock) {
          if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
          }
          setIsAnimateVisible(false);
          setIsHiding(false);
        }
        setIsCalendarOpen(false);
        setShowSequence((current) => current + 1);
      },
    );
    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
      void calendarOpenedPromise.then((unlisten) => unlisten());
      void calendarClosedPromise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    if (autoHideSeconds === undefined) return undefined;
    void showSequence;
    if (isCalendarOpen) return undefined;
    if (autoHideSeconds <= 0) return undefined;

    const timer = setTimeout(hideClock, autoHideSeconds * 1000);
    return () => clearTimeout(timer);
  }, [autoHideSeconds, showSequence, isCalendarOpen, hideClock]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hideClock();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hideClock]);

  useEffect(() => {
    const currentWindow = getCurrentWindow();
    if (typeof currentWindow.onCloseRequested !== "function") return;

    const closeRequested = currentWindow.onCloseRequested(() => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      setIsAnimateVisible(false);
      setIsHiding(false);
    });
    return () => {
      void closeRequested.then((unlisten) => unlisten());
    };
  }, []);

  const animationClass = isHiding
    ? "is-hiding"
    : isAnimateVisible
      ? "is-visible"
      : "";

  return {
    settings,
    hideClock,
    animationClass,
    isAnimateVisible,
    isHiding,
    clockColor:
      settings?.clock.clockColor ?? defaultAppSettings.clock.clockColor,
  };
};
