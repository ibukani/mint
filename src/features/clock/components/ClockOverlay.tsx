import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppSettings } from "../../../core/context/AppSettings";
import { Button } from "../../../design/components";
import { OverlayCard, OverlayFrame } from "../../../design/layout";
import { formatClockDate, formatClockSummary } from "../formatting";

const TickingClock: React.FC<{ showDate: boolean }> = ({ showDate }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="overlay-clock-time">
      <time dateTime={time.toISOString()}>
        <span className="sr-only">{formatClockSummary(time)}</span>
        <span aria-hidden="true">
          {time.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </time>
      {showDate ? (
        <time className="overlay-clock-date" dateTime={time.toISOString()}>
          <span className="sr-only">{formatClockDate(time)}</span>
          <span aria-hidden="true">{formatClockDate(time)}</span>
        </time>
      ) : null}
    </div>
  );
};

export const ClockOverlay: React.FC = () => {
  const { settings } = useAppSettings();
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideClock = useCallback(() => {
    getCurrentWindow()
      .hide()
      .catch((e) => {
        console.error("Failed to hide clock window:", e);
      });
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    if (!settings) return;

    const hideSeconds = settings.clock.autoHideSeconds;
    if (hideSeconds > 0) {
      hideTimerRef.current = setTimeout(() => {
        hideClock();
      }, hideSeconds * 1000);
    }
  }, [clearHideTimer, hideClock, settings]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let disposed = false;

    void listen("clock-shown", () => {
      scheduleHide();
    }).then((cleanup) => {
      if (disposed) {
        cleanup();
        return;
      }
      unlisten = cleanup;
    });

    return () => {
      disposed = true;
      clearHideTimer();
      unlisten?.();
    };
  }, [clearHideTimer, scheduleHide]);

  useEffect(() => {
    scheduleHide();
    return clearHideTimer;
  }, [clearHideTimer, scheduleHide]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        hideClock();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hideClock]);

  return (
    <OverlayFrame>
      <OverlayCard
        style={
          {
            "--overlay-font-size": settings?.clock.fontSize,
          } as React.CSSProperties
        }
      >
        <Button
          variant="ghost"
          className="overlay-close-button"
          aria-label="時計オーバーレイを閉じる"
          onClick={hideClock}
        >
          閉じる
        </Button>
        <div className="overlay-clock-content">
          <TickingClock showDate={settings?.clock.showDate ?? false} />
          <p className="overlay-clock-hint">Esc でも閉じられます。</p>
        </div>
      </OverlayCard>
    </OverlayFrame>
  );
};
