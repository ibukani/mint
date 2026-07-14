import { Search, X } from "lucide-react";
import type React from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { TextInput } from "../components";
import type { SidebarTab } from "./Sidebar";
import { revealElementVertically } from "./scrollVisibility";

interface SettingsQuickSwitcherProps<TTabId extends string> {
  tabs: readonly SidebarTab<TTabId>[];
  activeTab: TTabId;
  isOpen: boolean;
  onClose: () => void;
  onTabChange: (tabId: TTabId) => void;
}

const normalizeSearchText = (value: string) =>
  value.toLocaleLowerCase("ja").replace(/\s+/g, "");

export const SettingsQuickSwitcher = <TTabId extends string>({
  tabs,
  activeTab,
  isOpen,
  onClose,
  onTabChange,
}: SettingsQuickSwitcherProps<TTabId>) => {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const resultsId = useId();

  const filteredTabs = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return tabs;

    return tabs.filter((tab) => {
      const searchableText = [
        tab.label,
        tab.navigationLabel,
        tab.description,
        ...(tab.keywords ?? []),
      ]
        .filter(Boolean)
        .join(" ");
      return normalizeSearchText(searchableText).includes(normalizedQuery);
    });
  }, [query, tabs]);
  const selectedTab = filteredTabs[activeIndex];

  useEffect(() => {
    if (!isOpen) return undefined;

    previouslyFocusedElement.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setQuery("");
    setActiveIndex(
      Math.max(
        0,
        tabs.findIndex((tab) => tab.id === activeTab),
      ),
    );
    inputRef.current?.focus();

    return () => previouslyFocusedElement.current?.focus();
  }, [activeTab, isOpen, tabs]);

  useEffect(() => {
    if (!isOpen || !selectedTab) return;
    const results = resultsRef.current;
    const activeOption = results?.querySelector<HTMLElement>(
      ".settings-switcher__option.is-active",
    );
    if (results && activeOption) {
      revealElementVertically(results, activeOption, 8);
    }
  }, [isOpen, selectedTab]);

  if (!isOpen) return null;

  const selectTab = (tabId: TTabId) => {
    onTabChange(tabId);
    onClose();
  };

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab") return;
    const focusableElements = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]):not([tabindex='-1']), input:not([disabled]):not([tabindex='-1'])",
      ) ?? [],
    );
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement?.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  const handleSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        filteredTabs.length === 0 ? 0 : (current + 1) % filteredTabs.length,
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        filteredTabs.length === 0
          ? 0
          : (current - 1 + filteredTabs.length) % filteredTabs.length,
      );
      return;
    }
    if (event.key === "Enter" && selectedTab) {
      event.preventDefault();
      selectTab(selectedTab.id);
    }
  };

  return (
    <div className="settings-switcher-backdrop" data-window-drag-block>
      <button
        type="button"
        className="settings-switcher-backdrop__dismiss"
        onClick={onClose}
        aria-label="検索を閉じる"
        tabIndex={-1}
      />
      <div
        ref={dialogRef}
        className="settings-switcher"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleDialogKeyDown}
      >
        <div className="settings-switcher__header">
          <div>
            <span className="settings-switcher__eyebrow">QUICK SWITCH</span>
            <h2 id={titleId}>設定を検索</h2>
          </div>
          <button
            type="button"
            className="settings-switcher__close"
            onClick={onClose}
            aria-label="検索を閉じる"
            title="検索を閉じる"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        <div className="settings-switcher__search">
          <Search size={18} aria-hidden="true" />
          <TextInput
            ref={inputRef}
            value={query}
            role="combobox"
            aria-label="設定カテゴリを検索"
            aria-controls={resultsId}
            aria-expanded="true"
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-activedescendant={
              selectedTab ? `${resultsId}-${selectedTab.id}` : undefined
            }
            autoComplete="off"
            placeholder="機能名や設定内容を入力…"
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleSearchKeyDown}
          />
        </div>

        <div
          ref={resultsRef}
          id={resultsId}
          className="settings-switcher__results"
          role="listbox"
          aria-label="設定カテゴリ"
        >
          {filteredTabs.map((tab, index) => (
            <button
              type="button"
              role="option"
              id={`${resultsId}-${tab.id}`}
              key={tab.id}
              tabIndex={-1}
              className={`settings-switcher__option ${
                index === activeIndex ? "is-active" : ""
              }`}
              aria-selected={index === activeIndex}
              onClick={() => selectTab(tab.id)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span
                className="settings-switcher__option-icon"
                aria-hidden="true"
              >
                {tab.icon}
              </span>
              <span className="settings-switcher__option-copy">
                <strong>{tab.label}</strong>
                {tab.description && <small>{tab.description}</small>}
              </span>
              {tab.id === activeTab && (
                <span className="settings-switcher__current">表示中</span>
              )}
            </button>
          ))}
          {filteredTabs.length === 0 && (
            <div className="settings-switcher__empty">
              <Search size={20} aria-hidden="true" />
              <strong>一致する設定がありません</strong>
              <span>別の機能名や設定内容で検索してください。</span>
            </div>
          )}
        </div>

        <div className="settings-switcher__footer">
          <span aria-live="polite">{filteredTabs.length} 件のカテゴリ</span>
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> 選択 <kbd>Enter</kbd> 移動
          </span>
        </div>
      </div>
    </div>
  );
};
