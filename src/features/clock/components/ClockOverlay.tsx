import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useAppSettings } from "../../../core/context/AppSettings";
import { useTimeoutTask } from "../../../core/hooks/useTimeoutTask";
import { Button } from "../../../design/components";
import { OverlayCard, OverlayFrame } from "../../../design/layout";
import { formatClockDate, formatClockSummary } from "../formatting";

const TickingClock: React.FC<{ showDate: boolean }> = ({ showDate }) => {
  const [time, setTime] = useState(new Date());
  const clockTimestamp = time.toISOString();
  const clockDate = formatClockDate(time);
  const clockSummary = formatClockSummary(time);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="overlay-clock-time">
      <time dateTime={clockTimestamp}>
        <span className="sr-only">{clockSummary}</span>
        <span aria-hidden="true">
          {time.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </time>
      {showDate ? (
        <time className="overlay-clock-date" dateTime={clockTimestamp}>
          <span className="sr-only">{clockDate}</span>
          <span aria-hidden="true">{clockDate}</span>
        </time>
      ) : null}
    </div>
  );
};

export const ClockOverlay: React.FC = () => {
  const { settings } = useAppSettings();
  const { clearTimeoutTask, scheduleTimeoutTask } = useTimeoutTask();

  const hideClock = useCallback(() => {
    getCurrentWindow()
      .hide()
      .catch((e) => {
        console.error("Failed to hide clock window:", e);
      });
  }, []);

  const scheduleHide = useCallback(() => {
    clearTimeoutTask();
    if (!settings) return;

    const hideSeconds = settings.clock.autoHideSeconds;
    if (hideSeconds > 0) {
      scheduleTimeoutTask(() => {
        hideClock();
      }, hideSeconds * 1000);
    }
  }, [clearTimeoutTask, hideClock, scheduleTimeoutTask, settings]);

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
      clearTimeoutTask();
      unlisten?.();
    };
  }, [clearTimeoutTask, scheduleHide]);

  useEffect(() => {
    scheduleHide();
    return clearTimeoutTask;
  }, [clearTimeoutTask, scheduleHide]);

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
