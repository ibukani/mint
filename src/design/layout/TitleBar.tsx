import { getCurrentWindow } from "@tauri-apps/api/window";
import type React from "react";

interface TitleBarProps {
  title?: string;
}

export const TitleBar: React.FC<TitleBarProps> = ({ title = "mint" }) => {
  const handleMinimize = async () => {
    try {
      const win = getCurrentWindow();
      if (typeof win.minimize === "function") {
        await win.minimize();
      }
    } catch (e) {
      console.warn("Failed to minimize window:", e);
    }
  };

  const handleClose = async () => {
    try {
      const win = getCurrentWindow();
      if (typeof win.close === "function") {
        await win.close();
      }
    } catch (e) {
      console.warn("Failed to close window:", e);
    }
  };

  const handleMouseDown = async (e: React.MouseEvent) => {
    if (e.button === 0) {
      const target = e.target as HTMLElement;
      if (target.closest(".app-titlebar__controls")) {
        return;
      }
      try {
        const win = getCurrentWindow();
        if (typeof win.startDragging === "function") {
          await win.startDragging();
        }
      } catch (err) {
        console.warn("Failed to start dragging window:", err);
      }
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: window dragging area
    <div
      className="app-titlebar"
      data-tauri-drag-region
      onMouseDown={handleMouseDown}
    >
      <div className="app-titlebar__logo" data-tauri-drag-region>
        <span className="app-titlebar__icon" data-tauri-drag-region>
          🍃
        </span>
        <span className="app-titlebar__text" data-tauri-drag-region>
          {title}
        </span>
      </div>
      <div className="app-titlebar__controls">
        <button
          type="button"
          className="app-titlebar__button app-titlebar__button--minimize"
          onClick={handleMinimize}
          aria-label="最小化"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          >
            <line x1="2.5" y1="6" x2="9.5" y2="6" />
          </svg>
        </button>
        <button
          type="button"
          className="app-titlebar__button app-titlebar__button--close"
          onClick={handleClose}
          aria-label="閉じる"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          >
            <line x1="2.5" y1="2.5" x2="9.5" y2="9.5" />
            <line x1="9.5" y1="2.5" x2="2.5" y2="9.5" />
          </svg>
        </button>
      </div>
    </div>
  );
};
