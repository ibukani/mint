import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
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
  displayMode: "digital" | "analog";
  hourFormat: "12h" | "24h";
  glowEffect: boolean;
  clockColor: string;
}

export const getClockDimensions = (
  displayMode: "digital" | "analog",
  showDate: boolean,
) => {
  if (displayMode === "analog") {
    return { width: 240, height: showDate ? 250 : 190 };
  }

  return { width: 420, height: showDate ? 168 : 132 };
};

const AnalogClock: React.FC<{
  time: Date;
  showSeconds: boolean;
  glowEffect: boolean;
  clockColor: string;
}> = ({ time, showSeconds, glowEffect, clockColor }) => {
  const ms = time.getMilliseconds();
  const secs = time.getSeconds() + ms / 1000;
  const mins = time.getMinutes() + secs / 60;
  const hours = (time.getHours() % 12) + mins / 60;

  const secDeg = secs * 6;
  const minDeg = mins * 6;
  const hrDeg = hours * 30;

  const hourTicks = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((tick) => {
    const angle = (tick * 30 * Math.PI) / 180;
    const x1 = 100 + 78 * Math.sin(angle);
    const y1 = 100 - 78 * Math.cos(angle);
    const x2 = 100 + 86 * Math.sin(angle);
    const y2 = 100 - 86 * Math.cos(angle);
    const isMain = tick % 3 === 0;
    return (
      <line
        key={tick}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={clockColor}
        strokeWidth={isMain ? "2.5" : "1.2"}
        opacity={isMain ? "0.85" : "0.4"}
      />
    );
  });

  const glowStyle = glowEffect
    ? {
        filter: `drop-shadow(0 0 4px ${clockColor}) drop-shadow(0 0 8px ${clockColor}80)`,
      }
    : undefined;

  return (
    <div
      className={`analog-clock-container ${glowEffect ? "glow" : ""}`}
      role="img"
      aria-label={`現在時刻 ${String(time.getHours()).padStart(2, "0")}時${String(time.getMinutes()).padStart(2, "0")}分`}
    >
      <svg viewBox="0 0 200 200" className="analog-clock">
        {/* Face */}
        <circle cx="100" cy="100" r="90" className="analog-clock-face" />

        {/* Ticks */}
        {hourTicks}

        {/* Hour Hand */}
        <line
          x1="100"
          y1="100"
          x2="100"
          y2="55"
          className="analog-hand analog-hour-hand"
          style={{
            transform: `rotate(${hrDeg}deg)`,
            transformOrigin: "100px 100px",
            stroke: "var(--color-text-primary)",
            ...glowStyle,
          }}
        />

        {/* Minute Hand */}
        <line
          x1="100"
          y1="100"
          x2="100"
          y2="36"
          className="analog-hand analog-minute-hand"
          style={{
            transform: `rotate(${minDeg}deg)`,
            transformOrigin: "100px 100px",
            stroke: "var(--color-text-primary)",
            opacity: 0.9,
            ...glowStyle,
          }}
        />

        {/* Second Hand */}
        {showSeconds && (
          <line
            x1="100"
            y1="115"
            x2="100"
            y2="28"
            className="analog-hand analog-second-hand"
            style={{
              transform: `rotate(${secDeg}deg)`,
              transformOrigin: "100px 100px",
              stroke: clockColor,
              ...glowStyle,
            }}
          />
        )}

        {/* Center Pin */}
        <circle cx="100" cy="100" r="4.5" fill="var(--color-text-primary)" />
        <circle cx="100" cy="100" r="2.2" fill={clockColor} />
      </svg>
    </div>
  );
};

export const TickingClock: React.FC<TickingClockProps> = ({
  showDate,
  showSeconds,
  blinkColon,
  displayMode,
  hourFormat,
  glowEffect,
  clockColor,
}) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    if (displayMode === "analog") {
      let animId: number;
      const update = () => {
        setTime(new Date());
        animId = requestAnimationFrame(update);
      };
      animId = requestAnimationFrame(update);
      return () => cancelAnimationFrame(animId);
    } else {
      const intervalMs = showSeconds ? 200 : 1000;
      const timer = setInterval(() => setTime(new Date()), intervalMs);
      return () => clearInterval(timer);
    }
  }, [displayMode, showSeconds]);

  const rawHours = time.getHours();
  const is12h = hourFormat === "12h";
  const ampm = rawHours >= 12 ? "PM" : "AM";
  const displayHours = is12h
    ? String(rawHours % 12 === 0 ? 12 : rawHours % 12).padStart(2, "0")
    : String(rawHours).padStart(2, "0");

  const minutes = String(time.getMinutes()).padStart(2, "0");
  const seconds = String(time.getSeconds()).padStart(2, "0");

  const formattedDate = `${time.getFullYear()}年${time.getMonth() + 1}月${time.getDate()}日`;
  const weekday = WEEKDAY_LABELS[time.getDay()];

  const isBlinkOff = blinkColon && time.getSeconds() % 2 === 0;
  const machineDate = `${time.getFullYear()}-${String(time.getMonth() + 1).padStart(2, "0")}-${String(time.getDate()).padStart(2, "0")}`;
  const machineTime = `${String(rawHours).padStart(2, "0")}:${minutes}:${seconds}`;

  return (
    <>
      {displayMode === "analog" ? (
        <AnalogClock
          time={time}
          showSeconds={showSeconds}
          glowEffect={glowEffect}
          clockColor={clockColor}
        />
      ) : (
        <div className="digital-clock">
          {showDate && (
            <div className="digital-clock__header">
              <time className="digital-clock__date" dateTime={machineDate}>
                <span className="digital-clock__year">
                  {time.getFullYear()}年
                </span>
                <span className="digital-clock__month-day">
                  {time.getMonth() + 1}月{time.getDate()}日
                </span>
              </time>
              <span
                className="digital-clock__date-divider"
                aria-hidden="true"
              />
              <span className="digital-clock__weekday">{weekday}</span>
            </div>
          )}
          <div className="digital-clock__body">
            <time
              className={`digital-clock__time ${glowEffect ? "glow-effect" : ""}`}
              dateTime={machineTime}
            >
              <span className="clock-digits">{displayHours}</span>
              <span
                className={`clock-colon ${isBlinkOff ? "blink-off" : ""}`}
                aria-hidden="true"
              >
                :
              </span>
              <span className="clock-digits">{minutes}</span>
            </time>
            {(showSeconds || is12h) && (
              <div className="digital-clock__meta">
                <span className="clock-ampm">{is12h ? ampm : "秒"}</span>
                {showSeconds && (
                  <span className="clock-seconds">{seconds}</span>
                )}
              </div>
            )}
          </div>
          {showSeconds && (
            <div className="digital-clock__progress" aria-hidden="true">
              <span
                style={
                  {
                    "--clock-second-progress": `${((time.getSeconds() + time.getMilliseconds() / 1000) / 60) * 100}%`,
                  } as React.CSSProperties
                }
              />
            </div>
          )}
        </div>
      )}
      {showDate && displayMode === "analog" && (
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

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    hideTimerRef.current = setTimeout(() => {
      getCurrentWindow()
        .hide()
        .then(() => {
          setIsHiding(false);
          hideTimerRef.current = null;
        })
        .catch((e) => {
          console.error("Failed to hide clock window:", e);
          setIsHiding(false);
          hideTimerRef.current = null;
        });
    }, 280);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (settings && !settings.clock.enabled) {
      getCurrentWindow()
        .hide()
        .catch((e) => console.error("Failed to hide clock window:", e));
    }
  }, [settings]);

  useEffect(() => {
    if (!settings) return;

    const scale = settings.clock.sizePercent / 100;
    const dimensions = getClockDimensions(
      settings.clock.displayMode,
      settings.clock.showDate,
    );
    const w = Math.round(dimensions.width * scale) + 16;
    const h = Math.round(dimensions.height * scale) + 16;

    const win = getCurrentWindow();
    import("@tauri-apps/api/dpi")
      .then(({ LogicalSize }) => {
        if (typeof win.setSize === "function") {
          win.setSize(new LogicalSize(w, h)).catch((err) => {
            console.error("Failed to resize clock window:", err);
          });
        }
      })
      .catch((err) => {
        console.error("Failed to load Tauri DPI module:", err);
      });
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
        className={`${animationClass} overlay-card--${settings?.clock.displayMode ?? "digital"}`}
        role="dialog"
        aria-label="時計オーバーレイ"
        style={
          {
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
          aria-keyshortcuts="Escape"
          title="閉じる（Esc）"
          onClick={hideClock}
        >
          <X size={15} aria-hidden="true" />
        </button>
        <div className="overlay-clock-content">
          <TickingClock
            showDate={settings?.clock.showDate ?? false}
            showSeconds={settings?.clock.showSeconds ?? true}
            blinkColon={settings?.clock.blinkColon ?? true}
            displayMode={settings?.clock.displayMode ?? "digital"}
            hourFormat={settings?.clock.hourFormat ?? "24h"}
            glowEffect={settings?.clock.glowEffect ?? true}
            clockColor={clockColor}
          />
        </div>
      </OverlayCard>
    </OverlayFrame>
  );
};
