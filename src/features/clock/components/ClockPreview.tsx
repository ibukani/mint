import { X } from "lucide-react";
import type React from "react";
import type { ClockSettingsController } from "../hooks/useClockSettingsController";
import { TickingClock } from "./ClockDisplay";

export const ClockPreview: React.FC<{
  controller: ClockSettingsController;
}> = ({ controller }) => {
  const { clock, previewDimensions } = controller;

  return (
    <aside className="clock-preview-panel" aria-label="時計のライブプレビュー">
      <div className="clock-preview-header">
        <div>
          <span className="clock-preview-kicker">ライブプレビュー</span>
          <h3>
            {clock.displayMode === "digital" ? "デジタル時計" : "アナログ時計"}
          </h3>
        </div>
        <span className="clock-preview-scale">{clock.sizePercent}%</span>
      </div>
      <div className="clock-preview-stage">
        <div
          className={`overlay-card clock-preview-card overlay-card--${clock.displayMode} is-visible`}
          style={
            {
              "--preview-width": `${previewDimensions.width}px`,
              "--preview-height": `${previewDimensions.height}px`,
              "--clock-accent-color": clock.clockColor,
              "--clock-size-scale": Math.min(clock.sizePercent / 100, 1.15),
            } as React.CSSProperties
          }
        >
          <button
            type="button"
            className="overlay-close-button"
            aria-label="時計オーバーレイを閉じる（プレビュー）"
            title="閉じる（Esc）"
            tabIndex={-1}
            onClick={(event) => event.preventDefault()}
          >
            <X size={15} aria-hidden="true" />
          </button>
          <div className="overlay-clock-content">
            <TickingClock
              showDate={clock.showDate}
              showSeconds={clock.showSeconds}
              blinkColon={clock.blinkColon}
              displayMode={clock.displayMode}
              hourFormat={clock.hourFormat}
              glowEffect={clock.glowEffect}
              clockColor={clock.clockColor}
            />
          </div>
        </div>
      </div>
      <p className="clock-preview-note">
        変更は即座に反映され、自動で保存されます。
      </p>
    </aside>
  );
};
