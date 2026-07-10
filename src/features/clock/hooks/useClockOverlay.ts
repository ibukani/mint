import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppSettings } from "../../../core/context/AppSettings";
import { defaultAppSettings } from "../../../core/defaultSettings";

const HIDE_ANIMATION_MS = 280;

export const useClockOverlay = () => {
  const { settings } = useAppSettings();
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

  const hideClock = useCallback(() => {
    setIsAnimateVisible(false);
    setIsHiding(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);

    hideTimerRef.current = setTimeout(() => {
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
    }, HIDE_ANIMATION_MS);
  }, []);

  useEffect(
    () => () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (settings && !settings.clock.enabled) {
      getCurrentWindow()
        .hide()
        .catch((error) => console.error("Failed to hide clock window:", error));
    }
  }, [settings]);

  useEffect(() => {
    const unlistenPromise = listen("clock-shown", () => {
      setIsAnimateVisible(true);
      setIsHiding(false);
      setIsCalendarOpen(false);
      setShowSequence((current) => current + 1);
    });
    const calendarOpenedPromise = listen("calendar-opened", () => {
      setIsCalendarOpen(true);
    });
    const calendarClosedPromise = listen("calendar-closed", () => {
      setIsCalendarOpen(false);
      setShowSequence((current) => current + 1);
    });
    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
      void calendarOpenedPromise.then((unlisten) => unlisten());
      void calendarClosedPromise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    if (!settings) return undefined;
    void showSequence;
    if (isCalendarOpen) return undefined;
    if (settings.clock.autoHideSeconds <= 0) return undefined;

    const timer = setTimeout(hideClock, settings.clock.autoHideSeconds * 1000);
    return () => clearTimeout(timer);
  }, [settings, showSequence, isCalendarOpen, hideClock]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hideClock();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hideClock]);

  const animationClass = isHiding
    ? "is-hiding"
    : isAnimateVisible
      ? "is-visible"
      : "";

  return {
    settings,
    hideClock,
    animationClass,
    clockColor:
      settings?.clock.clockColor ?? defaultAppSettings.clock.clockColor,
  };
};
