import type React from "react";
import { useEffect, useRef } from "react";

export interface SidebarTab<TTabId extends string = string> {
  id: TTabId;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface SidebarProps<TTabId extends string> {
  title: string;
  tabs: readonly SidebarTab<TTabId>[];
  activeTab: TTabId;
  onTabChange: (tabId: TTabId) => void;
  statusLabel?: string;
  statusTone?: "neutral" | "pending" | "success" | "error";
}

export const Sidebar = <TTabId extends string>({
  title,
  tabs,
  activeTab,
  onTabChange,
  statusLabel = "設定は自動保存されます",
  statusTone = "neutral",
}: SidebarProps<TTabId>) => {
  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: activeTab changes which button receives the ref.
  useEffect(() => {
    const activeTabButton = activeTabRef.current;
    if (
      !activeTabButton ||
      typeof activeTabButton.scrollIntoView !== "function"
    ) {
      return;
    }

    activeTabButton.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeTab]);

  return (
    <nav className="app-sidebar" aria-label="設定カテゴリ">
      <div className="app-sidebar__brand">
        <img
          src="/mint.svg"
          alt="mint logo"
          className="app-sidebar__brand-mark"
          aria-hidden="true"
        />
        <div>
          <h1 className="app-sidebar__title">{title}</h1>
          <p className="app-sidebar__subtitle">デスクトップツール</p>
        </div>
      </div>
      <p className="app-sidebar__section-label">設定</p>
      <div className="app-sidebar__navigation">
        {tabs.map((tab, index) => (
          <button
            type="button"
            key={tab.id}
            className={`app-sidebar__button ${
              activeTab === tab.id ? "app-sidebar__button--active" : ""
            }`}
            ref={activeTab === tab.id ? activeTabRef : undefined}
            aria-label={tab.label}
            aria-describedby={
              tab.description
                ? `app-sidebar-tab-${tab.id}-description`
                : undefined
            }
            aria-current={activeTab === tab.id ? "page" : undefined}
            aria-keyshortcuts={`Control+${index + 1} Meta+${index + 1}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="app-sidebar__button-icon" aria-hidden="true">
              {tab.icon}
            </span>
            <span className="app-sidebar__button-copy">
              <span>{tab.label}</span>
              {tab.description && (
                <small id={`app-sidebar-tab-${tab.id}-description`}>
                  {tab.description}
                </small>
              )}
            </span>
            <kbd className="app-sidebar__shortcut">Ctrl {index + 1}</kbd>
          </button>
        ))}
      </div>
      <div className="app-sidebar__footer">
        <span
          className={`app-sidebar__status-dot app-sidebar__status-dot--${statusTone}`}
          aria-hidden="true"
        />
        <span>{statusLabel}</span>
      </div>
    </nav>
  );
};
