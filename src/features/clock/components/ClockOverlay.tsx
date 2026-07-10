import { X } from "lucide-react";
import type React from "react";
import { OverlayCard, OverlayFrame } from "../../../design/layout";
import { useClockOverlay } from "../hooks/useClockOverlay";
import { TickingClock } from "./ClockDisplay";

export { getClockDimensions, TickingClock } from "./ClockDisplay";

export const ClockOverlay: React.FC = () => {
  const { settings, hideClock, animationClass, clockColor } = useClockOverlay();

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
