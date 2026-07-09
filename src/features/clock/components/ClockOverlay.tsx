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
  displayMode: "digital" | "analog";
  hourFormat: "12h" | "24h";
  glowEffect: boolean;
  clockColor: string;
}

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
    <div className={`analog-clock-container ${glowEffect ? "glow" : ""}`}>
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
        <div
          className={`overlay-clock-time ${glowEffect ? "glow-effect" : ""}`}
        >
          {is12h && <span className="clock-ampm">{ampm}</span>}
          <span className="clock-digits">{displayHours}</span>
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
      )}
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
    if (!settings) return;

    const scale = settings.clock.sizePercent / 100;
    const isAnalog = settings.clock.displayMode === "analog";
    const w = Math.round((isAnalog ? 240 : 300) * scale);
    const h = Math.round(
      (isAnalog ? (settings.clock.showDate ? 250 : 190) : 110) * scale,
    );

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
