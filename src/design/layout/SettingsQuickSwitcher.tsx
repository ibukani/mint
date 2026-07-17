import { ArrowRight, Search, Trash2, X } from "lucide-react";
import { TextInput } from "../components";
import { SettingsQuickSwitcherOption } from "./SettingsQuickSwitcherOption";
import type { SidebarQuickAction, SidebarTab } from "./Sidebar";
import { useSettingsQuickSwitcher } from "./useSettingsQuickSwitcher";

interface SettingsQuickSwitcherProps<TTabId extends string> {
  tabs: readonly SidebarTab<TTabId>[];
  activeTab: TTabId;
  isOpen: boolean;
  onClose: () => void;
  onTabChange: (tabId: TTabId, targetId?: string) => void;
  quickActions?: readonly SidebarQuickAction<TTabId>[];
  onQuickAction?: (targetId: string) => Promise<void> | void;
}

export const SettingsQuickSwitcher = <TTabId extends string>({
  tabs,
  activeTab,
  isOpen,
  onClose,
  onTabChange,
  quickActions = [],
  onQuickAction,
}: SettingsQuickSwitcherProps<TTabId>) => {
  const switcher = useSettingsQuickSwitcher({
    tabs,
    activeTab,
    isOpen,
    onClose,
    onTabChange,
    quickActions,
    onQuickAction,
  });

  if (!isOpen) return null;

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
        ref={switcher.dialogRef}
        className="settings-switcher"
        role="dialog"
        aria-modal="true"
        aria-labelledby={switcher.titleId}
        onKeyDown={switcher.handleDialogKeyDown}
      >
        <div className="settings-switcher__header">
          <div>
            <span className="settings-switcher__eyebrow">QUICK ACTIONS</span>
            <h2 id={switcher.titleId}>クイックランチャー</h2>
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
            ref={switcher.inputRef}
            value={switcher.query}
            role="combobox"
            aria-label="設定や項目、操作を検索"
            aria-controls={switcher.resultsId}
            aria-expanded="true"
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-keyshortcuts="ArrowDown ArrowUp Home End PageUp PageDown Enter Escape"
            aria-activedescendant={
              switcher.selectedResult
                ? `${switcher.resultsId}-${switcher.selectedResult.key}`
                : undefined
            }
            autoComplete="off"
            placeholder="機能名、設定、操作を入力…"
            onChange={(event) => switcher.handleQueryChange(event.target.value)}
            onKeyDown={switcher.handleSearchKeyDown}
          />
          {switcher.query && (
            <button
              type="button"
              className="settings-switcher__clear"
              aria-label="クイックランチャーの検索をクリア"
              title="検索をクリア"
              onClick={switcher.clearQuery}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        {switcher.recentResults.length > 0 && (
          <div className="settings-switcher__section-label">
            <span>最近使った項目</span>
            <button
              type="button"
              className="settings-switcher__clear-recent"
              aria-label="最近使った項目を消去"
              title="最近使った項目を消去"
              onClick={switcher.clearRecent}
            >
              <Trash2 size={13} aria-hidden="true" />
              履歴を消去
            </button>
          </div>
        )}
        <div
          ref={switcher.resultsRef}
          id={switcher.resultsId}
          className="settings-switcher__results"
          role="listbox"
          aria-label="設定カテゴリ・項目・操作"
        >
          {switcher.orderedResults.map((result, index) => (
            <SettingsQuickSwitcherOption
              key={result.key}
              result={result}
              resultId={`${switcher.resultsId}-${result.key}`}
              index={index}
              activeIndex={switcher.activeIndex}
              activeTab={activeTab}
              isRecent={switcher.recentResultKeys.has(result.key)}
              isSelecting={switcher.isSelecting}
              onClick={() => void switcher.selectResult(result)}
              onMouseEnter={() => switcher.onMouseEnter(index)}
            />
          ))}
          {switcher.orderedResults.length === 0 && (
            <div className="settings-switcher__empty">
              <Search size={20} aria-hidden="true" />
              <strong>一致する設定や操作がありません</strong>
              <span>別の機能名、設定内容、操作名で検索してください。</span>
            </div>
          )}
        </div>

        <div className="settings-switcher__footer">
          {switcher.actionError && (
            <div className="settings-switcher__action-error">
              <span role="alert">{switcher.actionError}</span>
              {switcher.disabledAction?.disabledSettingsTarget && (
                <button
                  type="button"
                  className="settings-switcher__action-settings"
                  onClick={() => {
                    const target =
                      switcher.disabledAction?.disabledSettingsTarget;
                    if (!target) return;
                    onTabChange(target.tabId, target.targetId);
                    onClose();
                  }}
                >
                  詳細設定を開く
                  <ArrowRight size={13} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
          <span aria-live="polite">
            {switcher.orderedResults.length} 件の候補
          </span>
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> 選択 <kbd>Enter</kbd> 決定
          </span>
        </div>
      </div>
    </div>
  );
};
