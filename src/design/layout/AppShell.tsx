import type React from "react";
import { Panel } from "../components/Panel";
import { ContentArea } from "./ContentArea";
import { Sidebar, type SidebarTab } from "./Sidebar";
import { TitleBar } from "./TitleBar";
import { useWindowDrag } from "./useWindowDrag";

interface AppShellProps<TTabId extends string> {
  title: string;
  tabs: readonly SidebarTab<TTabId>[];
  activeTab: TTabId;
  onTabChange: (tabId: TTabId) => void;
  contextLabel?: string;
  statusLabel?: string;
  statusTone?: "neutral" | "pending" | "success" | "error";
  children: React.ReactNode;
}

export const AppShell = <TTabId extends string>({
  title,
  tabs,
  activeTab,
  onTabChange,
  contextLabel,
  statusLabel,
  statusTone,
  children,
}: AppShellProps<TTabId>) => {
  const windowDragHandlers = useWindowDrag();
  return (
    <Panel className="app-shell" {...windowDragHandlers}>
      <TitleBar title={title} contextLabel={contextLabel} />
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
