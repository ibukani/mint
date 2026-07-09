import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useAppSettings } from "../../../core/context/AppSettings";
import { Button } from "../../../design/components";
import { OverlayCard, OverlayFrame } from "../../../design/layout";

const TickingClock: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div>
      {time.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}
    </div>
  );
};

export const ClockOverlay: React.FC = () => {
  const { settings } = useAppSettings();
  const [trigger, setTrigger] = useState(0);

  const hideClock = useCallback(() => {
    getCurrentWindow()
      .hide()
      .catch((e) => {
        console.error("Failed to hide clock window:", e);
      });
  }, []);

  // listen to "clock-shown" event to restart timer
  useEffect(() => {
    const unlistenPromise = listen("clock-shown", () => {
      setTrigger((prev) => prev + 1);
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    if (!settings) return;
    void trigger; // Dummy reference for dependency array linter
    const hideSeconds = settings.clock.autoHideSeconds;
    if (hideSeconds > 0) {
      const timer = setTimeout(() => {
        getCurrentWindow()
          .hide()
          .catch((e) => console.error("Failed to hide clock window:", e));
      }, hideSeconds * 1000);
      return () => clearTimeout(timer);
    }
  }, [settings, trigger]);

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
        <TickingClock />
      </OverlayCard>
    </OverlayFrame>
  );
};
