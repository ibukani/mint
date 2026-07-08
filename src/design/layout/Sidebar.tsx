export interface SidebarTab<TTabId extends string = string> {
  id: TTabId;
  label: string;
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
      <h1 className="app-sidebar__title">{title}</h1>
      {tabs.map((tab) => (
        <button
          type="button"
          key={tab.id}
          className={`app-sidebar__button ${
            activeTab === tab.id ? "app-sidebar__button--active" : ""
          }`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
};
