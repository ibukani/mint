import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Search, X } from "lucide-react";
import type React from "react";

interface TitleBarProps {
  title?: string;
  contextLabel?: string;
  quickSwitcherShortcut?: string;
  quickSwitcherAriaShortcut?: string;
  onOpenQuickSwitcher?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  title = "mint",
  contextLabel = "設定",
  quickSwitcherShortcut = "Ctrl K",
  quickSwitcherAriaShortcut = "Control+K",
  onOpenQuickSwitcher,
}) => {
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

  return (
    <div className="app-titlebar">
      <div className="app-titlebar__logo">
        <img
          src="/mint.svg"
          alt=""
          className="app-titlebar__icon"
          aria-hidden="true"
        />
        <span className="app-titlebar__text">{title}</span>
        <span className="app-titlebar__separator" aria-hidden="true">
          /
        </span>
        <span className="app-titlebar__context">{contextLabel}</span>
      </div>
      {onOpenQuickSwitcher && (
        <button
          type="button"
          className="app-titlebar__search"
          onClick={onOpenQuickSwitcher}
          aria-label="クイックランチャーを開く"
          aria-keyshortcuts={quickSwitcherAriaShortcut}
          title={`${quickSwitcherShortcut} でクイックランチャーを開く`}
          data-window-drag-block
        >
          <Search size={14} aria-hidden="true" />
          <span>クイックランチャー</span>
          <kbd>{quickSwitcherShortcut}</kbd>
        </button>
      )}
      <div className="app-titlebar__controls">
        <button
          type="button"
          className="app-titlebar__button app-titlebar__button--minimize"
          onClick={handleMinimize}
          aria-label="最小化"
          title="最小化"
        >
          <Minus size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="app-titlebar__button app-titlebar__button--close"
          onClick={handleClose}
          aria-label="閉じる"
          title="閉じる"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
