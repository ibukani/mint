import type React from "react";
import { useEffect, useRef } from "react";
import { getPlatformShortcutModifier } from "./keyboard";

export interface SidebarTab<TTabId extends string = string> {
  id: TTabId;
  label: string;
  navigationLabel?: string;
  description?: string;
  icon?: React.ReactNode;
  keywords?: readonly string[];
  searchItems?: readonly SidebarSearchItem[];
}

export interface SidebarSearchItem {
  id: string;
  label: string;
  description?: string;
  keywords?: readonly string[];
  targetId: string;
}

export interface SidebarQuickAction {
  id: string;
  label: string;
  description?: string;
  keywords?: readonly string[];
  targetId: string;
  icon?: React.ReactNode;
}

type SidebarStatusTone = "neutral" | "pending" | "success" | "error";

interface SidebarProps<TTabId extends string> {
  title: string;
  tabs: readonly SidebarTab<TTabId>[];
  activeTab: TTabId;
  onTabChange: (tabId: TTabId) => void;
  statusLabel?: string;
  statusTone?: SidebarStatusTone;
}

const NAVIGATION_SCROLL_PADDING = 12;

const statusTitles: Record<SidebarStatusTone, string> = {
  neutral: "自動保存",
  pending: "保存待ち",
  success: "保存済み",
  error: "保存エラー",
};

const revealActiveTab = (activeTabButton: HTMLButtonElement) => {
  const navigation = activeTabButton.parentElement;
  if (!navigation) return;

  if (
    navigation.clientHeight > 0 &&
    navigation.scrollHeight > navigation.clientHeight
  ) {
    const tabTop = activeTabButton.offsetTop;
    const tabBottom = tabTop + activeTabButton.offsetHeight;
    const visibleTop = navigation.scrollTop;
    const visibleBottom = visibleTop + navigation.clientHeight;
    const isOutsideVisibleArea =
      tabTop < visibleTop + NAVIGATION_SCROLL_PADDING ||
      tabBottom > visibleBottom - NAVIGATION_SCROLL_PADDING;

    if (isOutsideVisibleArea) {
      const maxScrollTop = navigation.scrollHeight - navigation.clientHeight;
      const centeredScrollTop =
        tabTop + activeTabButton.offsetHeight / 2 - navigation.clientHeight / 2;
      const nextScrollTop = Math.min(
        maxScrollTop,
        Math.max(0, centeredScrollTop),
      );

      if (nextScrollTop !== visibleTop) {
        if (typeof navigation.scrollTo === "function") {
          navigation.scrollTo({ top: nextScrollTop, behavior: "smooth" });
        } else {
          navigation.scrollTop = nextScrollTop;
        }
      }
    }
  }

  if (
    navigation.clientWidth === 0 ||
    navigation.scrollWidth <= navigation.clientWidth
  )
    return;

  const tabLeft = activeTabButton.offsetLeft;
  const tabRight = tabLeft + activeTabButton.offsetWidth;
  const visibleLeft = navigation.scrollLeft;
  const visibleRight = visibleLeft + navigation.clientWidth;
  const isOutsideVisibleArea =
    tabLeft < visibleLeft + NAVIGATION_SCROLL_PADDING ||
    tabRight > visibleRight - NAVIGATION_SCROLL_PADDING;
  if (!isOutsideVisibleArea) return;

  const maxScrollLeft = navigation.scrollWidth - navigation.clientWidth;
  const centeredScrollLeft =
    tabLeft + activeTabButton.offsetWidth / 2 - navigation.clientWidth / 2;
  const nextScrollLeft = Math.min(
    maxScrollLeft,
    Math.max(0, centeredScrollLeft),
  );

  if (nextScrollLeft === visibleLeft) return;

  if (typeof navigation.scrollTo === "function") {
    navigation.scrollTo({ left: nextScrollLeft, behavior: "smooth" });
  } else {
    navigation.scrollLeft = nextScrollLeft;
  }
};

export const Sidebar = <TTabId extends string>({
  title,
  tabs,
  activeTab,
  onTabChange,
  statusLabel = "設定は自動保存されます",
  statusTone = "neutral",
}: SidebarProps<TTabId>) => {
  const activeTabRef = useRef<HTMLButtonElement | null>(null);
  const shortcutModifier = getPlatformShortcutModifier();

  // biome-ignore lint/correctness/useExhaustiveDependencies: activeTab changes which button receives the ref.
  useEffect(() => {
    const activeTabButton = activeTabRef.current;
    if (activeTabButton) revealActiveTab(activeTabButton);
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
              <span>{tab.navigationLabel ?? tab.label}</span>
              {tab.description && (
                <small id={`app-sidebar-tab-${tab.id}-description`}>
                  {tab.description}
                </small>
              )}
            </span>
            <kbd className="app-sidebar__shortcut">
              {shortcutModifier} {index + 1}
            </kbd>
          </button>
        ))}
      </div>
      <div
        className="app-sidebar__footer"
        aria-live={statusTone === "neutral" ? undefined : "polite"}
      >
        <span
          className={`app-sidebar__status-dot app-sidebar__status-dot--${statusTone}`}
          aria-hidden="true"
        />
        <span className="app-sidebar__footer-copy">
          <strong>{statusTitles[statusTone]}</strong>
          <span>{statusLabel}</span>
        </span>
      </div>
    </nav>
  );
};
