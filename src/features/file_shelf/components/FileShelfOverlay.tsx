import { Archive, ChevronRight, X } from "lucide-react";
import type React from "react";
import { OverlayFrame } from "../../../design/layout";
import { useFileShelfOverlayController } from "../hooks/useFileShelfOverlayController";
import { FileShelfContent } from "./FileShelfContent";
import { FileShelfOverlayFeedback } from "./FileShelfOverlayFeedback";
import { FileShelfOverlayHeader } from "./FileShelfOverlayHeader";
import { FileShelfPreview } from "./FileShelfPreview";
import { FileShelfRenameForm } from "./FileShelfRenameForm";
import { FileShelfSelectionActions } from "./FileShelfSelectionActions";
import "./FileShelfOverlay.css";

export const FileShelfOverlay: React.FC = () => {
  const {
    shelf,
    rowDrag,
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
          className={`file-shelf-handle${shelf.isDropTarget ? " is-drop-target" : ""}`}
          onClick={() => void shelf.changeExpanded(true)}
          aria-label={`ファイルシェルを開く、${shelf.itemCount}件`}
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
        className={`file-shelf${shelf.isDropTarget ? " is-drop-target" : ""}`}
        aria-label="ファイルシェル"
        aria-keyshortcuts="F2"
        tabIndex={-1}
        onPaste={(event) => void handlePaste(event)}
        onKeyDown={handleKeyDown}
        onMouseEnter={stopCollapseTimer}
        onMouseLeave={scheduleCollapse}
      >
        <FileShelfOverlayHeader
          shelf={shelf}
          query={query}
          visibleItemCount={visibleItems.length}
          searchRef={searchRef}
          shortcutModifier={shortcutModifier}
          shortcutAriaModifier={shortcutAriaModifier}
          onQueryChange={setQuery}
          onClearQuery={() => setQuery("")}
          onFocusSearch={focusSearch}
        />
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
          onDragItems={(items, shiftKey) =>
            void shelf.dragItems(items, shiftKey)
          }
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
        {!editingItem && shelf.pendingDragCount === 0 && (
          <FileShelfSelectionActions
            shelf={shelf}
            selectedItems={selectedItems}
            removableSelectedItems={removableSelectedItems}
            onStartRenaming={startRenaming}
            onTogglePreview={togglePreview}
          />
        )}
        <FileShelfOverlayFeedback
          shelf={shelf}
          editing={Boolean(editingItem)}
        />
      </section>
    </OverlayFrame>
  );
};
