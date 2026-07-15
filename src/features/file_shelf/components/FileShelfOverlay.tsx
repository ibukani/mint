import {
  Archive,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Copy,
  ExternalLink,
  Eye,
  FolderPlus,
  FolderSearch,
  History,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type React from "react";
import { OverlayFrame } from "../../../design/layout";
import { useFileShelfOverlayController } from "../hooks/useFileShelfOverlayController";
import { FileShelfContent } from "./FileShelfContent";
import { FileShelfPreview } from "./FileShelfPreview";
import { FileShelfRenameForm } from "./FileShelfRenameForm";
import "./FileShelfOverlay.css";

export const FileShelfOverlay: React.FC = () => {
  const {
    shelf,
    rowDrag,
    themeColor,
    expandedGroups,
    selectedIds,
    query,
    setQuery,
    normalizedQuery,
    visibleGroups,
    visibleItems,
    previewItem,
    previewPinned,
    setPreviewPinned,
    previewDataUrl,
    previewLoading,
    previewError,
    editingItem,
    editingName,
    setEditingName,
    cursorKey,
    containerRef,
    contentRef,
    searchRef,
    previewCloseRef,
    renameInputRef,
    shortcutModifier,
    shortcutAriaModifier,
    selectedItems,
    removableSelectedItems,
    stopCollapseTimer,
    scheduleCollapse,
    handlePaste,
    selectItem,
    closePreview,
    togglePreview,
    startRenaming,
    cancelRenaming,
    commitRename,
    toggleGroup,
    focusSearch,
    handleKeyDown,
  } = useFileShelfOverlayController();
  if (!shelf.expanded) {
    return (
      <OverlayFrame>
        <button
          type="button"
          className={`file-shelf-handle theme-accent-scope${shelf.isDropTarget ? " is-drop-target" : ""}`}
          onClick={() => void shelf.changeExpanded(true)}
          aria-label={`ファイルシェルを開く、${shelf.itemCount}件`}
          style={{ "--color-accent": themeColor } as React.CSSProperties}
        >
          <Archive size={17} aria-hidden="true" />
          <strong>{shelf.itemCount}</strong>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </OverlayFrame>
    );
  }

  return (
    <OverlayFrame>
      <button
        type="button"
        className="overlay-close-button"
        aria-label="シェルフを折りたたむ"
        aria-keyshortcuts="Escape"
        title="折りたたむ（Esc）"
        onClick={() => void shelf.changeExpanded(false)}
      >
        <X size={15} aria-hidden="true" />
      </button>

      <section
        ref={containerRef}
        className={`file-shelf theme-accent-scope${shelf.isDropTarget ? " is-drop-target" : ""}`}
        aria-label="ファイルシェル"
        aria-keyshortcuts="F2"
        tabIndex={-1}
        onPaste={(event) => void handlePaste(event)}
        onKeyDown={handleKeyDown}
        onMouseEnter={stopCollapseTimer}
        onMouseLeave={scheduleCollapse}
        style={{ "--color-accent": themeColor } as React.CSSProperties}
      >
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
            onChange={(event) => setQuery(event.target.value)}
            placeholder="棚を検索"
            aria-label="棚を検索"
            aria-keyshortcuts={`${shortcutAriaModifier}+F ArrowDown ArrowUp Home End PageUp PageDown Enter Escape`}
          />
          {query ? (
            <>
              <span className="file-shelf__search-count" aria-live="polite">
                {visibleItems.length}件
              </span>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  focusSearch();
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

        <FileShelfContent
          contentRef={contentRef}
          visibleGroups={visibleGroups}
          totalGroupCount={shelf.state.groups.length}
          loading={shelf.loading}
          normalizedQuery={normalizedQuery}
          expandedGroups={expandedGroups}
          selectedIds={selectedIds}
          cursorKey={cursorKey}
          busy={shelf.busy}
          rowDrag={rowDrag}
          onChoosePaths={() => void shelf.choosePaths()}
          onChooseFolders={() => void shelf.chooseFolders()}
          onClearQuery={() => setQuery("")}
          onToggleGroup={toggleGroup}
          onSelectItem={selectItem}
          onOpenItem={(item) => void shelf.openItem(item)}
          onDragItems={(items, shiftKey) => {
            void shelf.dragItems(items, shiftKey);
          }}
        />

        {previewItem && (
          <FileShelfPreview
            item={previewItem}
            pinned={previewPinned}
            dataUrl={previewDataUrl}
            loading={previewLoading}
            error={previewError}
            closeRef={previewCloseRef}
            onTogglePinned={() => setPreviewPinned((current) => !current)}
            onClose={closePreview}
            onCopy={(item) => void shelf.copyItem(item)}
            onOpen={(item) => void shelf.openItem(item)}
          />
        )}

        {editingItem && (
          <FileShelfRenameForm
            name={editingName}
            busy={shelf.busy}
            inputRef={renameInputRef}
            onNameChange={setEditingName}
            onSubmit={() => void commitRename()}
            onCancel={cancelRenaming}
          />
        )}

        {shelf.pendingDragCount > 0 && !editingItem && (
          <div
            className="file-shelf__drag-confirmation"
            role="status"
            aria-live="polite"
          >
            <CheckCircle2 size={17} aria-hidden="true" />
            <span>
              <strong>ドロップ先を確認</strong>
              <small>
                {shelf.pendingDragCount}件が追加できていたら棚から外します
              </small>
            </span>
            <div className="file-shelf__drag-confirmation-actions">
              <button
                type="button"
                onClick={shelf.keepDraggedItems}
                disabled={shelf.busy}
              >
                棚に残す
              </button>
              <button
                type="button"
                className="is-primary"
                onClick={() => void shelf.confirmDraggedItems()}
                disabled={shelf.busy}
              >
                棚から外す
              </button>
            </div>
          </div>
        )}

        {selectedItems.length > 0 &&
          !editingItem &&
          shelf.pendingDragCount === 0 && (
            <div className="file-shelf__selection-actions">
              <span>{selectedItems.length}件を選択</span>
              {selectedItems.length === 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => startRenaming(selectedItems[0])}
                    aria-label="棚での表示名を変更"
                    title="棚での表示名を変更（F2）"
                  >
                    <Pencil size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePreview(selectedItems[0])}
                    aria-label="選択項目をプレビュー"
                    title="クイックプレビュー（Q）"
                  >
                    <Eye size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void shelf.copyItem(selectedItems[0])}
                    aria-label="選択項目をコピー"
                  >
                    <Copy size={15} aria-hidden="true" />
                  </button>
                  {(selectedItems[0].sourcePath ||
                    selectedItems[0].kind === "url") && (
                    <button
                      type="button"
                      onClick={() => void shelf.openItem(selectedItems[0])}
                      aria-label="選択項目を開く"
                    >
                      <ExternalLink size={15} aria-hidden="true" />
                    </button>
                  )}
                  {selectedItems[0].sourcePath && (
                    <button
                      type="button"
                      onClick={() => void shelf.revealItem(selectedItems[0])}
                      aria-label="Explorerで表示"
                    >
                      <FolderSearch size={15} aria-hidden="true" />
                    </button>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={() =>
                  void shelf.pinItems(
                    selectedItems,
                    !selectedItems.every((item) => item.pinned),
                  )
                }
                aria-label={
                  selectedItems.every((item) => item.pinned)
                    ? "選択項目の固定を解除"
                    : "選択項目を棚に固定"
                }
                title={
                  selectedItems.every((item) => item.pinned)
                    ? "固定を解除"
                    : "取り出しや全消去後も棚に残す"
                }
              >
                {selectedItems.every((item) => item.pinned) ? (
                  <PinOff size={15} aria-hidden="true" />
                ) : (
                  <Pin size={15} aria-hidden="true" />
                )}
              </button>
              {selectedItems.length > 1 && (
                <button
                  type="button"
                  onClick={() => void shelf.copyItems(selectedItems)}
                  aria-label="選択項目をコピー"
                >
                  <Copy size={15} aria-hidden="true" />
                </button>
              )}
              {removableSelectedItems.length > 0 && (
                <button
                  type="button"
                  className="is-danger"
                  onClick={() =>
                    void shelf.removeItems(
                      removableSelectedItems.map((item) => item.id),
                    )
                  }
                  aria-label={
                    removableSelectedItems.length === selectedItems.length
                      ? "選択項目を棚から外す"
                      : "固定されていない選択項目を棚から外す"
                  }
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              )}
            </div>
          )}

        <footer className="file-shelf__footer">
          <div className="file-shelf__feedback">
            {shelf.error ? (
              <span className="is-error" role="alert">
                {shelf.error}
              </span>
            ) : (
              <span>
                {shelf.notice ||
                  "F2: 名前 · Q: プレビュー · ↑↓: 移動 · Shiftで取り出し"}
              </span>
            )}
          </div>
          {shelf.undoToken ? (
            <button type="button" onClick={() => void shelf.undo()}>
              <RotateCcw size={14} aria-hidden="true" />
              元に戻す
            </button>
          ) : (
            shelf.itemCount > shelf.pinnedCount && (
              <button
                type="button"
                onClick={() => void shelf.clear()}
                disabled={shelf.busy}
              >
                <Trash2 size={14} aria-hidden="true" />
                {shelf.pinnedCount > 0 ? "固定以外を外す" : "すべて外す"}
              </button>
            )
          )}
        </footer>
      </section>
    </OverlayFrame>
  );
};
