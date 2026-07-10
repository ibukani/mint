import type React from "react";
import { Panel } from "../components/Panel";
import { ContentArea } from "./ContentArea";
import { Sidebar, type SidebarTab } from "./Sidebar";
import { TitleBar } from "./TitleBar";

interface AppShellProps<TTabId extends string> {
  title: string;
  tabs: readonly SidebarTab<TTabId>[];
  activeTab: TTabId;
  onTabChange: (tabId: TTabId) => void;
  statusLabel?: string;
  statusTone?: "neutral" | "pending" | "success" | "error";
  children: React.ReactNode;
}

export const AppShell = <TTabId extends string>({
  title,
  tabs,
  activeTab,
  onTabChange,
  statusLabel,
  statusTone,
  children,
}: AppShellProps<TTabId>) => {
  return (
    <Panel className="app-shell">
      <TitleBar title={title} />
      <div className="app-shell__body">
        <Sidebar
          title={title}
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
          statusLabel={statusLabel}
          statusTone={statusTone}
        />
        <ContentArea>{children}</ContentArea>
      </div>
    </Panel>
  );
};
