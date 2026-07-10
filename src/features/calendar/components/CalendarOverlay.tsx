import { X } from "lucide-react";
import type React from "react";
import { useEffect } from "react";
import { OverlayCard, OverlayFrame } from "../../../design/layout";
import { useCalendarOverlay } from "../hooks/useCalendarOverlay";
import { MonthCalendar } from "./MonthCalendar";
import "./CalendarOverlay.css";

export const CalendarOverlay: React.FC = () => {
  const { animationClass, closeCalendar, isDocked, showSequence } =
    useCalendarOverlay();

  // Clear any residual CSS zoom left by previous code versions (HMR / cached WebView state)
  useEffect(() => {
    (
      document.documentElement.style as CSSStyleDeclaration & { zoom: string }
    ).zoom = "";
  }, []);

  return (
    <OverlayFrame>
      <OverlayCard
        className={`${animationClass} calendar-overlay-card${isDocked ? " is-docked" : ""}`}
        role="dialog"
        aria-label="カレンダーオーバーレイ"
      >
        <button
          type="button"
          className="overlay-close-button"
          aria-label="カレンダーオーバーレイを閉じる"
          aria-keyshortcuts="Escape"
          title="閉じる（Esc）"
          onClick={closeCalendar}
        >
          <X size={15} aria-hidden="true" />
        </button>
        <MonthCalendar showSequence={showSequence} />
      </OverlayCard>
    </OverlayFrame>
  );
};
