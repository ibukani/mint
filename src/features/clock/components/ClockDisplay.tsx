import type React from "react";
import { useEffect, useMemo, useState } from "react";
import "./ClockDisplay.css";

const WEEKDAY_LABELS = [
  "日曜日",
  "月曜日",
  "火曜日",
  "水曜日",
  "木曜日",
  "金曜日",
  "土曜日",
] as const;

const HOUR_TICKS = Array.from({ length: 12 }, (_, tick) => {
  const angle = (tick * 30 * Math.PI) / 180;
  const x1 = 100 + 78 * Math.sin(angle);
  const y1 = 100 - 78 * Math.cos(angle);
  const x2 = 100 + 86 * Math.sin(angle);
  const y2 = 100 - 86 * Math.cos(angle);
  const isMain = tick % 3 === 0;
  return { tick, x1, y1, x2, y2, isMain };
});

export interface TickingClockProps {
  isActive?: boolean;
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

  const hourTicks = useMemo(
    () =>
      HOUR_TICKS.map(({ tick, x1, y1, x2, y2, isMain }) => {
        return (
          <line
            key={tick}
            className={`analog-clock__tick${isMain ? " is-major" : ""}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
          />
        );
      }),
    [],
  );

  return (
    <div
      className={`analog-clock-container ${glowEffect ? "glow" : ""}`}
      role="img"
      aria-label={`現在時刻 ${String(time.getHours()).padStart(2, "0")}時${String(time.getMinutes()).padStart(2, "0")}分`}
      style={
        {
          "--clock-dynamic-color": clockColor,
        } as React.CSSProperties
      }
    >
      <svg viewBox="0 0 200 200" className="analog-clock">
        <circle cx="100" cy="100" r="90" className="analog-clock-face" />
        <circle cx="100" cy="100" r="82" className="analog-clock__inner" />
        {hourTicks}
        <line
          x1="100"
          y1="100"
          x2="100"
          y2="55"
          className="analog-hand analog-hour-hand"
          style={
            {
              "--hand-rotation": `${hrDeg}deg`,
            } as React.CSSProperties
          }
        />
        <line
          x1="100"
          y1="100"
          x2="100"
          y2="36"
          className="analog-hand analog-minute-hand"
          style={
            {
              "--hand-rotation": `${minDeg}deg`,
            } as React.CSSProperties
          }
        />
        {showSeconds && (
          <line
            x1="100"
            y1="115"
            x2="100"
            y2="28"
            className="analog-hand analog-second-hand"
            style={
              {
                "--hand-rotation": `${secDeg}deg`,
              } as React.CSSProperties
            }
          />
        )}
        <circle cx="100" cy="100" r="5" className="analog-clock__pin" />
        <circle cx="100" cy="100" r="2.2" className="analog-clock__pin-core" />
      </svg>
    </div>
  );
};

export const TickingClock: React.FC<TickingClockProps> = ({
  isActive = true,
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
    if (!isActive) return;

    setTime(new Date());
    // The rendered values only change once per second. Analog seconds keep a
    // shorter cadence for a smooth hand while avoiding unnecessary 10Hz React
    // renders for every clock and its live settings preview.
    const intervalMs = displayMode === "analog" && showSeconds ? 250 : 1000;
    const timer = setInterval(() => setTime(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [displayMode, isActive, showSeconds]);

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
                <span className="clock-ampm">{is12h ? ampm : "SEC"}</span>
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
          <time className="overlay-clock-date" dateTime={machineDate}>
            {formattedDate}
          </time>
          <span className="overlay-clock-weekday-badge">{weekday}</span>
        </div>
      )}
    </>
  );
};
