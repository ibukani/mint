import { ChevronDown, ChevronUp, Replace, Search, X } from "lucide-react";
import { type RefObject, useLayoutEffect } from "react";

interface QuickCaptureFindBarProps {
  inputRef: RefObject<HTMLInputElement | null>;
  query: string;
  replacement: string;
  matchCount: number;
  currentMatch: number;
  replaceOpen: boolean;
  caseSensitive: boolean;
  onQueryChange: (value: string) => void;
  onReplacementChange: (value: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  onToggleReplace: () => void;
  onToggleCaseSensitive: () => void;
  onClose: () => void;
}

export const QuickCaptureFindBar = ({
  inputRef,
  query,
  replacement,
  matchCount,
  currentMatch,
  replaceOpen,
  caseSensitive,
  onQueryChange,
  onReplacementChange,
  onPrevious,
  onNext,
  onReplace,
  onReplaceAll,
  onToggleReplace,
  onToggleCaseSensitive,
  onClose,
}: QuickCaptureFindBarProps) => {
  useLayoutEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [inputRef]);

  return (
    <section className="quick-capture__find-bar" aria-label="本文検索">
      <div className="quick-capture__find-row">
        <Search size={14} aria-hidden="true" />
        <input
          ref={inputRef}
          aria-label="本文を検索"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (event.shiftKey) onPrevious();
              else onNext();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
          }}
          placeholder="本文を検索…"
          autoComplete="off"
        />
        <span
          className="quick-capture__find-count"
          role="status"
          aria-live="polite"
        >
          {query
            ? matchCount > 0
              ? `${currentMatch}/${matchCount}`
              : "0件"
            : ""}
        </span>
        <button
          type="button"
          className="quick-capture__find-control"
          aria-label="前の一致へ"
          disabled={matchCount === 0}
          onClick={onPrevious}
          title="前の一致（Shift+Enter）"
        >
          <ChevronUp size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="quick-capture__find-control"
          aria-label="次の一致へ"
          disabled={matchCount === 0}
          onClick={onNext}
          title="次の一致（Enter）"
        >
          <ChevronDown size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`quick-capture__find-toggle${caseSensitive ? " is-active" : ""}`}
          aria-label="大文字小文字を区別"
          aria-pressed={caseSensitive}
          onClick={onToggleCaseSensitive}
          title="大文字小文字を区別"
        >
          Aa
        </button>
        <button
          type="button"
          className={`quick-capture__find-toggle${replaceOpen ? " is-active" : ""}`}
          aria-label="置換欄を表示"
          aria-expanded={replaceOpen}
          onClick={onToggleReplace}
          title="置換（Ctrl+H）"
        >
          <Replace size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="quick-capture__find-control"
          aria-label="本文検索を閉じる"
          onClick={onClose}
          title="閉じる（Escape）"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      {replaceOpen && (
        <div className="quick-capture__replace-row">
          <Replace size={14} aria-hidden="true" />
          <input
            aria-label="置換後の文字列"
            value={replacement}
            onChange={(event) => onReplacementChange(event.target.value)}
            placeholder="置換後の文字列…"
            autoComplete="off"
          />
          <button
            type="button"
            className="quick-capture__replace-button"
            disabled={matchCount === 0}
            onClick={onReplace}
          >
            置換
          </button>
          <button
            type="button"
            className="quick-capture__replace-button"
            disabled={matchCount === 0}
            onClick={onReplaceAll}
          >
            すべて置換
          </button>
        </div>
      )}
    </section>
  );
};
