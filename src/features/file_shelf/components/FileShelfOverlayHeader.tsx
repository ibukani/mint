import {
  Archive,
  Clipboard,
  FolderPlus,
  History,
  Plus,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import type React from "react";
import type { FileShelfController } from "../hooks/useFileShelf";

interface FileShelfOverlayHeaderProps {
  shelf: FileShelfController;
  query: string;
  visibleItemCount: number;
  searchRef: React.RefObject<HTMLInputElement | null>;
  shortcutModifier: string;
  shortcutAriaModifier: string;
  onQueryChange: (value: string) => void;
  onClearQuery: () => void;
  onFocusSearch: () => void;
}

export const FileShelfOverlayHeader: React.FC<FileShelfOverlayHeaderProps> = ({
  shelf,
  query,
  visibleItemCount,
  searchRef,
  shortcutModifier,
  shortcutAriaModifier,
  onQueryChange,
  onClearQuery,
  onFocusSearch,
}) => (
  <>
    <header className="file-shelf__header">
      <div className="file-shelf__title">
        <Archive size={19} aria-hidden="true" />
        <div>
          <h1>ファイルシェル</h1>
          <span>{shelf.itemCount}件を預かっています</span>
        </div>
      </div>
      <div className="file-shelf__header-actions">
        <button
          type="button"
          onClick={() => void shelf.restoreRecent()}
          aria-label="最近外した項目を戻す"
          title="最近外した項目を戻す（ショートカット長押し）"
          disabled={shelf.busy}
        >
          <RotateCcw size={17} aria-hidden="true" />
        </button>
        {shelf.clipboardHistoryCount > 0 && (
          <button
            type="button"
            onClick={() => void shelf.clearClipboardHistory()}
            aria-label="クリップボード履歴だけを消去"
            title="クリップボード履歴だけを消去"
            disabled={shelf.busy}
          >
            <History size={17} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={() => void shelf.choosePaths()}
          aria-label="ファイルを追加"
          title="ファイルを追加"
          disabled={shelf.busy}
        >
          <Plus size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => void shelf.chooseFolders()}
          aria-label="フォルダを追加"
          title="フォルダを追加"
          disabled={shelf.busy}
        >
          <FolderPlus size={17} aria-hidden="true" />
        </button>
      </div>
    </header>
    <div
      className={`file-shelf__paste-zone${shelf.isDropTarget ? " is-drop-target" : ""}`}
      role={shelf.isDropTarget ? "status" : undefined}
      aria-live="polite"
    >
      <Clipboard size={16} aria-hidden="true" />
      <span>
        {shelf.isDropTarget
          ? "ここにドロップしてファイルを追加"
          : "ここへドロップ、または Ctrl+V で画像・URL・文章を追加"}
      </span>
    </div>
    <label className="file-shelf__search">
      <Search size={15} aria-hidden="true" />
      <input
        ref={searchRef}
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="棚を検索"
        aria-label="棚を検索"
        aria-keyshortcuts={`${shortcutAriaModifier}+F ArrowDown ArrowUp Home End PageUp PageDown Enter Escape`}
      />
      {query ? (
        <>
          <span className="file-shelf__search-count" aria-live="polite">
            {visibleItemCount}件
          </span>
          <button
            type="button"
            onClick={() => {
              onClearQuery();
              onFocusSearch();
            }}
            aria-label="検索をクリア"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </>
      ) : (
        <kbd>{shortcutModifier} F</kbd>
      )}
    </label>
  </>
);
