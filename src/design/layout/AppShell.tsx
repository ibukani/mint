import type React from "react";
import { Panel } from "../components/Panel";
import { ContentArea } from "./ContentArea";
import { Sidebar, type SidebarTab } from "./Sidebar";

interface AppShellProps<TTabId extends string> {
  title: string;
  tabs: readonly SidebarTab<TTabId>[];
  activeTab: TTabId;
  onTabChange: (tabId: TTabId) => void;
  children: React.ReactNode;
}

export const AppShell = <TTabId extends string>({
  title,
  tabs,
  activeTab,
  onTabChange,
  children,
}: AppShellProps<TTabId>) => {
  return (
    <Panel className="app-shell">
      <Sidebar
        title={title}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
      />
      <ContentArea>{children}</ContentArea>
    </Panel>
  );
};
