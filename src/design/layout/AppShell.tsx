import type React from "react";
import { useEffect, useState } from "react";
import { Panel } from "../components/Panel";
import { ContentArea } from "./ContentArea";
import { getPlatformShortcutModifier, isApplePlatform } from "./keyboard";
import { SettingsQuickSwitcher } from "./SettingsQuickSwitcher";
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
  const [isQuickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
  const shortcutModifier = getPlatformShortcutModifier();
  const usesMetaShortcut = isApplePlatform();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const hasPlatformModifier = usesMetaShortcut
        ? event.metaKey && !event.ctrlKey
        : event.ctrlKey && !event.metaKey;
      if (
        !hasPlatformModifier ||
        event.altKey ||
        event.shiftKey ||
        event.key.toLocaleLowerCase() !== "k"
      ) {
        return;
      }

      event.preventDefault();
      setQuickSwitcherOpen(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [usesMetaShortcut]);

  return (
    <Panel className="app-shell" {...windowDragHandlers}>
      <a className="app-skip-link" href="#main-content">
        メインコンテンツへ移動
      </a>
      <TitleBar
        title={title}
        contextLabel={contextLabel}
        quickSwitcherShortcut={`${shortcutModifier} K`}
        quickSwitcherAriaShortcut={usesMetaShortcut ? "Meta+K" : "Control+K"}
        onOpenQuickSwitcher={() => setQuickSwitcherOpen(true)}
      />
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
      <SettingsQuickSwitcher
        tabs={tabs}
        activeTab={activeTab}
        isOpen={isQuickSwitcherOpen}
        onClose={() => setQuickSwitcherOpen(false)}
        onTabChange={onTabChange}
      />
    </Panel>
  );
};
