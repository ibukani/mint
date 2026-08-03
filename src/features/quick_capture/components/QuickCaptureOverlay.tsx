import { Command, PanelRightOpen, X } from "lucide-react";
import type React from "react";
import { useSettings } from "../../../core/context/AppSettings";
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
  const settings = useSettings();
  const {
    capture,
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
    libraryOpen,
    setLibraryOpen,
    editorSearchOpen,
    editorSearchQuery,
    editorSearchRef,
    replaceMode,
    replaceQuery,
    setEditorSearchQuery,
    setReplaceQuery,
    focusEditorMatch,
    closeEditorSearch,
    replaceEditorMatch,
    replaceAllEditorMatches,
    activeNote,
    filteredNotes,
    activeNotesCount,
    libraryTags,
    searchText,
    sortMode,
    setSortMode,
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
    formatSelection,
    requestDeleteNote,
    confirmDestructiveAction,
    cancelConfirmation,
    closeCommandPalette,
    commandPaletteOpen,
    handleLibrarySearchFocus,
    handleLibrarySearchBlur,
    focusLibrarySearch,
    handleQueryChange,
    handleClearFilters,
    handleTogglePinnedOnly,
    handleToggleAttachmentsOnly,
    handleToggleArchivedOnly,
    handleToggleTag,
    selectLibraryNote,
    indentSelection,
    openCommandPalette,
    createNewNote,
  } = useQuickCaptureOverlayController();
  return (
    <OverlayFrame>
      <OverlayCard
        className="quick-capture is-visible"
        role="dialog"
        aria-label="クイックキャプチャー"
        onKeyDown={handleKeyDown}
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
            <div className="quick-capture__heading-copy">
              <h1
                aria-label={
                  capture.activeId
                    ? noteTitle({
                        title: capture.title,
                        content: capture.content,
                      })
                    : "クイックキャプチャー"
                }
              >
                {capture.activeId ? (
                  <input
                    aria-label="メモのタイトル"
                    className="quick-capture__title-input"
                    value={capture.title ?? ""}
                    placeholder={noteTitle({ content: capture.content })}
                    onChange={(event) => capture.setTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                  />
                ) : (
                  "クイックキャプチャー"
                )}
              </h1>
            </div>
          </div>
          <div className="quick-capture__header-actions">
            <button
              type="button"
              className={`quick-capture__library-trigger${libraryOpen ? " is-active" : ""}`}
              aria-label={libraryOpen ? "メモ一覧を閉じる" : "メモ一覧を開く"}
              aria-pressed={libraryOpen}
              aria-keyshortcuts="Control+Shift+F Meta+Shift+F"
              title={`メモ一覧（${shortcutModifier}+Shift+F）`}
              onClick={() => {
                setLibraryOpen((open) => !open);
                requestAnimationFrame(() => {
                  if (!libraryOpen) focusLibrarySearch();
                });
              }}
            >
              <PanelRightOpen size={14} aria-hidden="true" />
              <span>メモ一覧</span>
            </button>
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
          </div>
        </header>

        <main
          className={`quick-capture__body${libraryOpen ? " has-library" : ""}${capture.openNotes.length > 1 ? " has-tabs" : ""}`}
        >
          {capture.openNotes.length > 1 && (
            <nav className="quick-capture__tabs" aria-label="開いているメモ">
              {capture.openNotes.map((note) => (
                <div
                  className={`quick-capture__tab${capture.activeId === note.id ? " is-active" : ""}`}
                  key={note.id}
                >
                  <button
                    type="button"
                    aria-label={`${noteTitle(note)}を選択`}
                    aria-current={capture.activeId === note.id}
                    onClick={() => void capture.selectNote(note)}
                  >
                    {noteTitle(note)}
                  </button>
                  {capture.activeId === note.id && (
                    <button
                      type="button"
                      aria-label={`${noteTitle(note)}をタブから閉じる`}
                      onClick={() => void capture.closeActiveTab()}
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
            </nav>
          )}
          <QuickCaptureEditor
            capture={capture}
            preview={preview}
            previewRef={previewRef}
            editorRef={editorRef}
            shortcutModifier={shortcutModifier}
            actionStatus={actionStatus}
            isSaving={isSaving}
            activeNote={activeNote}
            editorSettings={settings?.quickCapture}
            searchOpen={editorSearchOpen}
            searchQuery={editorSearchQuery}
            replaceMode={replaceMode}
            replaceQuery={replaceQuery}
            searchRef={editorSearchRef}
            onSearchQueryChange={setEditorSearchQuery}
            onReplaceQueryChange={setReplaceQuery}
            onSearchNext={() => focusEditorMatch(1)}
            onSearchPrevious={() => focusEditorMatch(-1)}
            onCloseSearch={closeEditorSearch}
            onReplace={replaceEditorMatch}
            onReplaceAll={replaceAllEditorMatches}
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
          {libraryOpen && (
            <QuickCaptureLibrary
              notes={capture.notes}
              filteredNotes={filteredNotes}
              activeNotesCount={activeNotesCount}
              activeId={capture.activeId}
              allTags={libraryTags}
              searchText={searchText}
              sortMode={sortMode}
              onSortChange={setSortMode}
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
              isSaving={isSaving}
              onCreateNewNote={() => void createNewNote()}
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
          )}
        </main>
      </OverlayCard>
      <QuickCaptureCommandPalette
        open={commandPaletteOpen}
        capture={capture}
        preview={preview}
        isSaving={isSaving}
        shortcutModifier={shortcutModifier}
        onClose={closeCommandPalette}
        onCreateNewNote={() => void createNewNote()}
        onFocusSearch={focusLibrarySearch}
        onSetPreview={setPreview}
        onPasteClipboard={() => void pasteClipboard()}
        onCaptureClipboard={() => void captureClipboard()}
        onCopyClipboard={() => void copyClipboard()}
        onExportMarkdown={() => void exportMarkdown()}
        onInsertTemplate={insertTemplate}
        onRequestDelete={() => {
          if (activeNote) requestDeleteNote(activeNote);
        }}
      />
      <ConfirmDialog
        open={confirmation !== null}
        title="このメモを削除しますか？"
        description={`「${confirmation ? noteTitle(confirmation.note) : "このメモ"}」を削除します。添付ファイルも保持され、直後なら「削除を取り消す」で復元できます。`}
        confirmLabel="削除する"
        busy={confirmationBusy}
        busyLabel="削除しています…"
        error={confirmationError}
        onCancel={cancelConfirmation}
        onConfirm={() => void confirmDestructiveAction()}
      />
    </OverlayFrame>
  );
};
