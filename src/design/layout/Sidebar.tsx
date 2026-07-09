import type React from "react";

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
}

export const Sidebar = <TTabId extends string>({
  title,
  tabs,
  activeTab,
  onTabChange,
}: SidebarProps<TTabId>) => {
  return (
    <nav className="app-sidebar" aria-label="設定カテゴリ">
      <div className="app-sidebar__brand">
        <span className="app-sidebar__brand-mark" aria-hidden="true">
          m
        </span>
        <div>
          <h1 className="app-sidebar__title">{title}</h1>
          <p className="app-sidebar__subtitle">デスクトップツール</p>
        </div>
      </div>
      <p className="app-sidebar__section-label">設定</p>
      <div className="app-sidebar__navigation">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            className={`app-sidebar__button ${
              activeTab === tab.id ? "app-sidebar__button--active" : ""
            }`}
            aria-label={tab.label}
            aria-current={activeTab === tab.id ? "page" : undefined}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="app-sidebar__button-icon">{tab.icon}</span>
            <span className="app-sidebar__button-copy">
              <span>{tab.label}</span>
              {tab.description && <small>{tab.description}</small>}
            </span>
          </button>
        ))}
      </div>
      <div className="app-sidebar__footer">
        <span className="app-sidebar__status-dot" />
        設定は自動保存されます
      </div>
    </nav>
  );
};
