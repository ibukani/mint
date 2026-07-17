import { Command, CopyPlus, FileText, Pin, X } from "lucide-react";
import type React from "react";
import { ConfirmDialog } from "../../../design/components";
import { OverlayCard, OverlayFrame } from "../../../design/layout";
import { useQuickCaptureOverlayController } from "../hooks/useQuickCaptureOverlayController";
import type { QuickCaptureTemplate } from "../templates";
import { noteTitle } from "../utils";
import { QuickCaptureCommandPalette } from "./QuickCaptureCommandPalette";
import { QuickCaptureEditor } from "./QuickCaptureEditor";
import { QuickCaptureLibrary } from "./QuickCaptureLibrary";
import "./QuickCaptureOverlay.css";

export { noteTitle };

export const QuickCaptureOverlay: React.FC = () => {
  const {
    capture,
    themeColor,
    continueList,
    insertTemplate,
    preview,
    setPreview,
    query,
    tagFilter,
    pinnedOnly,
    attachmentsOnly,
    archivedOnly,
    actionStatus,
    libraryCursorNote,
    librarySearchFocused,
    confirmation,
    confirmationBusy,
    confirmationError,
    editorRef,
    previewRef,
    librarySearchRef,
    noteListRef,
    noteListId,
    shortcutModifier,
    usesMetaShortcut,
    isSaving,
    activeNote,
    filteredNotes,
    pinnedCount,
    attachmentCount,
    archivedCount,
    setLibraryCursorId,
    handleKeyDown,
    handleLibrarySearchKeyDown,
    pasteClipboard,
    captureClipboard,
    copyClipboard,
    copySavedNote,
    exportMarkdown,
    formatBlock,
    exportBackup,
    formatSelection,
    requestImportBackup,
    requestDeleteNote,
    confirmDestructiveAction,
    cancelConfirmation,
    closeCommandPalette,
    commandPaletteOpen,
    handleLibrarySearchFocus,
    handleLibrarySearchBlur,
    focusSearch,
    handleQueryChange,
    handleClearFilters,
    handleTogglePinnedOnly,
    handleToggleAttachmentsOnly,
    handleToggleArchivedOnly,
    handleToggleTag,
    selectLibraryNote,
    indentSelection,
    openCommandPalette,
  } = useQuickCaptureOverlayController();
  return (
    <OverlayFrame>
      <OverlayCard
        className="quick-capture theme-accent-scope is-visible"
        role="dialog"
        aria-label="クイックキャプチャー"
        onKeyDown={handleKeyDown}
        style={{ "--color-accent": themeColor } as React.CSSProperties}
      >
        <button
          type="button"
          className="overlay-close-button"
          aria-label="クイックキャプチャーを閉じる"
          aria-keyshortcuts="Escape Alt+2"
          title="閉じる（Esc）"
          onClick={() => void capture.close()}
        >
          <X size={15} aria-hidden="true" />
        </button>

        <header className="quick-capture__header">
          <div className="quick-capture__heading">
            <span className="quick-capture__heading-icon" aria-hidden="true">
              <FileText size={17} />
            </span>
            <div>
              <h1>
                {capture.activeId
                  ? noteTitle({ content: capture.content })
                  : "クイックキャプチャー"}
              </h1>
              <span>
                {capture.activeId
                  ? "保存済みメモを編集中"
                  : "思いついたことを、そのままメモ"}
              </span>
            </div>
          </div>
          <div className="quick-capture__header-actions">
            <button
              type="button"
              className="quick-capture__command-trigger"
              aria-label="コマンドパレットを開く"
              aria-keyshortcuts="Control+K Meta+K"
              title={`コマンドパレット（${shortcutModifier}+K）`}
              onClick={openCommandPalette}
            >
              <Command size={14} aria-hidden="true" />
              <span>コマンド</span>
              <kbd>{shortcutModifier} K</kbd>
            </button>
            <button
              type="button"
              className={`quick-capture__window-pin${capture.windowPinned ? " is-active" : ""}`}
              aria-label={
                capture.windowPinned
                  ? "ウィンドウの固定を解除"
                  : "ウィンドウを固定"
              }
              aria-pressed={capture.windowPinned}
              title={
                capture.windowPinned
                  ? "固定を解除して、フォーカスを外したときに閉じる"
                  : "別のウィンドウを操作しても閉じない"
              }
              onClick={() => capture.setWindowPinned(!capture.windowPinned)}
            >
              <Pin size={14} aria-hidden="true" />
              <span>{capture.windowPinned ? "固定中" : "ウィンドウ固定"}</span>
            </button>
            {capture.activeId && (
              <>
                <button
                  type="button"
                  disabled={isSaving}
                  aria-keyshortcuts="Control+Shift+D Meta+Shift+D"
                  title={`メモを複製（${shortcutModifier}+Shift+D）`}
                  onClick={() => void capture.duplicateActive()}
                >
                  <CopyPlus size={14} aria-hidden="true" />
                  複製
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  aria-keyshortcuts="Control+N Meta+N"
                  title={`新しい下書きを開く（${shortcutModifier}+N）`}
                  onClick={() => void capture.openDraft()}
                >
                  下書きへ
                </button>
              </>
            )}
          </div>
        </header>

        <main className="quick-capture__body">
          <QuickCaptureEditor
            capture={capture}
            preview={preview}
            previewRef={previewRef}
            editorRef={editorRef}
            shortcutModifier={shortcutModifier}
            actionStatus={actionStatus}
            isSaving={isSaving}
            activeNote={activeNote}
            onSetPreview={setPreview}
            onPasteClipboard={() => void pasteClipboard()}
            onCaptureClipboard={() => void captureClipboard()}
            onCopyClipboard={() => void copyClipboard()}
            onFormat={formatSelection}
            onContinueList={continueList}
            onFormatBlock={formatBlock}
            onIndentSelection={indentSelection}
            onInsertTemplate={(template: QuickCaptureTemplate) =>
              insertTemplate(template)
            }
            onExportMarkdown={() => void exportMarkdown()}
            onRequestDelete={() => {
              if (activeNote) requestDeleteNote(activeNote);
            }}
          />
          <QuickCaptureLibrary
            notes={capture.notes}
            filteredNotes={filteredNotes}
            activeId={capture.activeId}
            allTags={capture.allTags}
            pinnedCount={pinnedCount}
            attachmentCount={attachmentCount}
            archivedCount={archivedCount}
            query={query}
            tagFilter={tagFilter}
            pinnedOnly={pinnedOnly}
            attachmentsOnly={attachmentsOnly}
            archivedOnly={archivedOnly}
            cursorNote={libraryCursorNote}
            searchFocused={librarySearchFocused}
            searchRef={librarySearchRef}
            noteListRef={noteListRef}
            noteListId={noteListId}
            shortcutModifier={shortcutModifier}
            usesMetaShortcut={usesMetaShortcut}
            onExportBackup={() => void exportBackup()}
            onImportBackup={() => void requestImportBackup()}
            onSearchFocus={handleLibrarySearchFocus}
            onSearchBlur={handleLibrarySearchBlur}
            onQueryChange={handleQueryChange}
            onSearchKeyDown={handleLibrarySearchKeyDown}
            onClearFilters={handleClearFilters}
            onTogglePinnedOnly={handleTogglePinnedOnly}
            onToggleAttachmentsOnly={handleToggleAttachmentsOnly}
            onToggleArchivedOnly={handleToggleArchivedOnly}
            onToggleTag={handleToggleTag}
            onCursorChange={setLibraryCursorId}
            onSelectNote={selectLibraryNote}
            onCopyNote={(note) => void copySavedNote(note)}
            onRequestDelete={requestDeleteNote}
          />
        </main>
      </OverlayCard>
      <QuickCaptureCommandPalette
        open={commandPaletteOpen}
        capture={capture}
        preview={preview}
        isSaving={isSaving}
        shortcutModifier={shortcutModifier}
        onClose={closeCommandPalette}
        onFocusSearch={focusSearch}
        onSetPreview={setPreview}
        onPasteClipboard={() => void pasteClipboard()}
        onCaptureClipboard={() => void captureClipboard()}
        onCopyClipboard={() => void copyClipboard()}
        onExportMarkdown={() => void exportMarkdown()}
        onExportBackup={() => void exportBackup()}
        onImportBackup={() => void requestImportBackup()}
        onInsertTemplate={insertTemplate}
        onRequestDelete={() => {
          if (activeNote) requestDeleteNote(activeNote);
        }}
      />
      <ConfirmDialog
        open={confirmation !== null}
        title={
          confirmation?.kind === "import"
            ? "バックアップから復元しますか？"
            : "このメモを削除しますか？"
        }
        description={
          confirmation?.kind === "import"
            ? `現在の下書きと保存済みメモ${capture.notes.length}件を、選択したバックアップの内容で置き換えます。`
            : `「${confirmation?.kind === "delete" ? noteTitle(confirmation.note) : "このメモ"}」を削除します。添付ファイルも保持され、直後なら「削除を取り消す」で復元できます。`
        }
        confirmLabel={
          confirmation?.kind === "import" ? "置き換えて復元" : "削除する"
        }
        busy={confirmationBusy}
        busyLabel={
          confirmation?.kind === "import"
            ? "復元しています…"
            : "削除しています…"
        }
        error={confirmationError}
        onCancel={cancelConfirmation}
        onConfirm={() => void confirmDestructiveAction()}
      />
    </OverlayFrame>
  );
};
