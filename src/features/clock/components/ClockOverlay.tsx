import React, { useState, useEffect } from "react";
import { useAppSettings } from "../../../core/context/AppSettings";

import { getCurrentWindow } from "@tauri-apps/api/window";

const TickingClock: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div>
      {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </div>
  );
};

export const ClockOverlay: React.FC = () => {
  const { settings } = useAppSettings();

  useEffect(() => {
    if (!settings) return;
    const hideSeconds = settings.clock.autoHideSeconds;
    if (hideSeconds > 0) {
      const timer = setTimeout(() => {
        getCurrentWindow().hide().catch((e) => console.error("Failed to hide clock window:", e));
      }, hideSeconds * 1000);
      return () => clearTimeout(timer);
    }
  }, [settings]);

  return (
    <div className="clock-overlay-container">
      <div className="clock-card" style={{ fontSize: settings?.clock.fontSize }}>
        <TickingClock />
      </div>
    </div>
  );
};
