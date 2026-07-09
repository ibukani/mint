import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useAppSettings } from "../../../core/context/AppSettings";
import { OverlayCard, OverlayFrame } from "../../../design/layout";

const WEEKDAY_LABELS = [
  "日曜日",
  "月曜日",
  "火曜日",
  "水曜日",
  "木曜日",
  "金曜日",
  "土曜日",
] as const;

interface TickingClockProps {
  showDate: boolean;
  showSeconds: boolean;
  blinkColon: boolean;
}

export const TickingClock: React.FC<TickingClockProps> = ({
  showDate,
  showSeconds,
  blinkColon,
}) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = String(time.getHours()).padStart(2, "0");
  const minutes = String(time.getMinutes()).padStart(2, "0");
  const seconds = String(time.getSeconds()).padStart(2, "0");

  const formattedDate = `${time.getFullYear()}年${time.getMonth() + 1}月${time.getDate()}日`;
  const weekday = WEEKDAY_LABELS[time.getDay()];

  const isBlinkOff = blinkColon && time.getSeconds() % 2 === 0;

  return (
    <>
      <div className="overlay-clock-time">
        <span className="clock-digits">{hours}</span>
        <span className={`clock-colon ${isBlinkOff ? "blink-off" : ""}`}>
          :
        </span>
        <span className="clock-digits">{minutes}</span>
        {showSeconds && (
          <>
            <span className="clock-seconds-separator">.</span>
            <span className="clock-digits clock-seconds">{seconds}</span>
          </>
        )}
      </div>
      {showDate && (
        <div className="overlay-clock-date-container">
          <span className="overlay-clock-date">{formattedDate}</span>
          <span className="overlay-clock-weekday-badge">{weekday}</span>
        </div>
      )}
    </>
  );
};

export const ClockOverlay: React.FC = () => {
  const { settings } = useAppSettings();
  const [isAnimateVisible, setIsAnimateVisible] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    setIsAnimateVisible(true);
    setIsHiding(false);
  }, []);

  const hideClock = useCallback(() => {
    setIsAnimateVisible(false);
    setIsHiding(true);

    setTimeout(() => {
      getCurrentWindow()
        .hide()
        .then(() => {
          setIsHiding(false);
        })
        .catch((e) => {
          console.error("Failed to hide clock window:", e);
          setIsHiding(false);
        });
    }, 280);
  }, []);

  useEffect(() => {
    if (settings && !settings.clock.enabled) {
      getCurrentWindow()
        .hide()
        .catch((e) => console.error("Failed to hide clock window:", e));
    }
  }, [settings]);

  useEffect(() => {
    const unlistenPromise = listen("clock-shown", () => {
      setIsAnimateVisible(true);
      setIsHiding(false);
      setTrigger((prev) => prev + 1);
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    if (!settings) return;
    void trigger;
    const hideSeconds = settings.clock.autoHideSeconds;
    if (hideSeconds > 0) {
      const timer = setTimeout(() => {
        hideClock();
      }, hideSeconds * 1000);
      return () => clearTimeout(timer);
    }
  }, [settings, trigger, hideClock]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        hideClock();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hideClock]);

  const clockColor = settings?.clock.clockColor ?? "#818cf8";

  let animationClass = "";
  if (isAnimateVisible && !isHiding) {
    animationClass = "is-visible";
  } else if (isHiding) {
    animationClass = "is-hiding";
  }

  return (
    <OverlayFrame>
      <OverlayCard
        className={animationClass}
        style={
          {
            "--overlay-font-size": settings?.clock.fontSize,
            "--clock-accent-color": clockColor,
            "--clock-size-scale": settings
              ? settings.clock.sizePercent / 100
              : 1,
          } as React.CSSProperties
        }
      >
        <button
          type="button"
          className="overlay-close-button"
          aria-label="時計オーバーレイを閉じる"
          onClick={hideClock}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <div className="overlay-clock-content">
          <TickingClock
            showDate={settings?.clock.showDate ?? false}
            showSeconds={settings?.clock.showSeconds ?? true}
            blinkColon={settings?.clock.blinkColon ?? true}
          />
          <p className="overlay-clock-hint">Esc でも閉じられます。</p>
        </div>
      </OverlayCard>
    </OverlayFrame>
  );
};
