import { Search, X } from "lucide-react";
import { useId } from "react";
import type { MintAction } from "../../../core/actions/mintActions";
import { openSettingsTab } from "../../../core/windowCommands";
import { OverlayFrame } from "../../../design/layout";
import { useMintPalette } from "../hooks/useMintPalette";
import "./MintPaletteOverlay.css";

const categoryLabel = (action: MintAction) => {
  switch (action.category) {
    case "tab":
      return "設定";
    case "setting":
      return "設定項目";
    case "action":
      return "操作";
  }
};

export const MintPaletteOverlay = () => {
  const resultsId = useId();
  const palette = useMintPalette();
  const results = palette.results;

  return (
    <OverlayFrame>
      <div
        className={
          palette.isAnimateVisible
            ? "mint-palette is-visible"
            : "mint-palette is-hiding"
        }
        role="dialog"
        aria-modal="true"
        aria-label="MintPalette"
        onKeyDown={palette.handleKeyDown}
      >
        <header className="mint-palette__header">
          <div>
            <p className="mint-palette__eyebrow">MintPalette</p>
            <h2 className="mint-palette__title">コマンドパレット</h2>
          </div>
          <button
            type="button"
            className="overlay-close-button"
            aria-label="閉じる"
            onClick={palette.hidePaletteWindow}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="mint-palette__search">
          <Search
            className="mint-palette__search-icon"
            size={16}
            aria-hidden="true"
          />
          <input
            ref={palette.inputRef}
            className="mint-palette__input"
            role="combobox"
            aria-label="操作や設定を検索"
            aria-controls={resultsId}
            aria-expanded="true"
            aria-autocomplete="list"
            aria-activedescendant={
              results[palette.activeIndex]
                ? `${resultsId}-${results[palette.activeIndex].key}`
                : undefined
            }
            placeholder="操作や設定を検索…"
            value={palette.query}
            onChange={(event) => palette.handleQueryChange(event.target.value)}
          />
          {palette.query.length > 0 && (
            <button
              type="button"
              className="mint-palette__clear"
              aria-label="検索をクリア"
              onClick={() => palette.handleQueryChange("")}
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        {palette.recentResults.length > 0 && (
          <p className="mint-palette__recent-label">最近使った項目</p>
        )}

        <div
          id={resultsId}
          ref={palette.resultsRef}
          className="mint-palette__results"
          role="listbox"
          aria-label="操作・設定を選択"
        >
          {results.length === 0 ? (
            <p className="mint-palette__empty">一致する操作がありません</p>
          ) : (
            results.map((action, index) => (
              <button
                key={action.key}
                type="button"
                role="option"
                id={`${resultsId}-${action.key}`}
                aria-selected={index === palette.activeIndex}
                className={
                  index === palette.activeIndex
                    ? "mint-palette__option is-active"
                    : "mint-palette__option"
                }
                onMouseEnter={() => palette.setActiveIndex(index)}
                onClick={() => void palette.selectAction(action)}
              >
                {action.icon && (
                  <span
                    className="mint-palette__option-icon"
                    aria-hidden="true"
                  >
                    {action.icon}
                  </span>
                )}
                <span className="mint-palette__option-body">
                  <span className="mint-palette__option-title">
                    {action.title}
                  </span>
                  {action.description && (
                    <span className="mint-palette__option-description">
                      {action.description}
                    </span>
                  )}
                </span>
                <span className="mint-palette__option-category">
                  {categoryLabel(action)}
                </span>
              </button>
            ))
          )}
        </div>

        <footer className="mint-palette__footer">
          {palette.actionError ? (
            <>
              <p className="mint-palette__error" role="alert">
                {palette.actionError}
              </p>
              {palette.disabledSettingsTarget && (
                <button
                  type="button"
                  className="mint-palette__settings-button"
                  onClick={() => {
                    const target = palette.disabledSettingsTarget;
                    if (target) {
                      void openSettingsTab(target.tabId, target.targetId);
                    }
                    palette.hidePaletteWindow();
                  }}
                >
                  詳細設定を開く
                </button>
              )}
            </>
          ) : (
            <>
              <span className="mint-palette__count" aria-live="polite">
                {results.length} 件の候補
              </span>
              <span className="mint-palette__hint">
                ↑↓ で移動・Enter で実行・Esc で閉じる
              </span>
            </>
          )}
        </footer>
      </div>
    </OverlayFrame>
  );
};
