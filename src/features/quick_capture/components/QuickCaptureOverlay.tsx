import { save } from "@tauri-apps/plugin-dialog";
import Fuse from "fuse.js";
import { CopyPlus, FileText, Pin, X } from "lucide-react";
import type React from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useAppSettings } from "../../../core/context/AppSettings";
import { defaultAppSettings } from "../../../core/defaultSettings";
import { ConfirmDialog } from "../../../design/components";
import {
  getPlatformShortcutModifier,
  isApplePlatform,
  OverlayCard,
  OverlayFrame,
  revealElementVertically,
} from "../../../design/layout";
import {
  chooseQuickCaptureBackupForOpen,
  chooseQuickCaptureBackupForSave,
  exportQuickCaptureMarkdown,
} from "../api";
import { useQuickCapture } from "../hooks/useQuickCapture";
import type { QuickCaptureNote } from "../types";
import { noteTitle, parseTags, safeFileName } from "../utils";
import { QuickCaptureEditor } from "./QuickCaptureEditor";
import { QuickCaptureLibrary } from "./QuickCaptureLibrary";
import "./QuickCaptureOverlay.css";

export { noteTitle };

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement && target.isContentEditable);

const QUICK_CAPTURE_PAGE_STEP = 5;

type QuickCaptureConfirmation =
  | { kind: "delete"; note: QuickCaptureNote }
  | { kind: "import"; path: string };

export const QuickCaptureOverlay: React.FC = () => {
  const { settings } = useAppSettings();
  const capture = useQuickCapture();
  const [preview, setPreview] = useState(false);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [actionStatus, setActionStatus] = useState("");
  const [libraryCursorId, setLibraryCursorId] = useState<string | null>(null);
  const [librarySearchFocused, setLibrarySearchFocused] = useState(false);
  const [confirmation, setConfirmation] =
    useState<QuickCaptureConfirmation | null>(null);
  const [confirmationBusy, setConfirmationBusy] = useState(false);
  const [confirmationError, setConfirmationError] = useState("");
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLElement | null>(null);
  const librarySearchRef = useRef<HTMLInputElement>(null);
  const librarySearchFocusedRef = useRef(false);
  const noteListRef = useRef<HTMLDivElement>(null);
  const noteListId = useId();
  const shortcutModifier = getPlatformShortcutModifier();
  const usesMetaShortcut = isApplePlatform();
  const { focusSequence } = capture;
  const isSaving = capture.status === "saving";
  const activeNote = capture.activeId
    ? (capture.notes.find((note) => note.id === capture.activeId) ?? null)
    : null;

  useEffect(() => {
    void focusSequence;
    if (librarySearchFocusedRef.current) return;
    const focusTarget = preview ? previewRef.current : editorRef.current;
    focusTarget?.focus();
    if (!preview) {
      const length = editorRef.current?.value.length ?? 0;
      editorRef.current?.setSelectionRange(length, length);
    }
  }, [focusSequence, preview]);

  useEffect(() => {
    void focusSequence;
    if (capture.activeId !== null) return;
    setPreview(false);
    setQuery("");
    setTagFilter(null);
    setPinnedOnly(false);
    setActionStatus("");
  }, [capture.activeId, focusSequence]);

  const filteredNotes = useMemo(() => {
    const tagged = capture.notes.filter(
      (note) =>
        (!pinnedOnly || note.pinned) &&
        (!tagFilter || note.tags.includes(tagFilter)),
    );
    if (!query.trim()) return tagged;
    return new Fuse(tagged, {
      keys: ["content", "tags"],
      threshold: 0.35,
      ignoreLocation: true,
    })
      .search(query)
      .map((result) => result.item);
  }, [capture.notes, pinnedOnly, query, tagFilter]);
  const libraryCursorNote =
    filteredNotes.find((note) => note.id === libraryCursorId) ??
    filteredNotes[0] ??
    null;
  const pinnedCount = capture.notes.filter((note) => note.pinned).length;

  useEffect(() => {
    if (!librarySearchFocused || !libraryCursorNote) return;
    const activeOption = noteListRef.current?.querySelector<HTMLElement>(
      ".quick-capture__note.is-keyboard-active",
    );
    if (noteListRef.current && activeOption) {
      revealElementVertically(noteListRef.current, activeOption, 4);
    }
  }, [libraryCursorNote, librarySearchFocused]);

  const focusLibrarySearch = () => {
    const activeNote = filteredNotes.find(
      (note) => note.id === capture.activeId,
    );
    setLibraryCursorId(activeNote?.id ?? filteredNotes[0]?.id ?? null);
    librarySearchRef.current?.focus({ preventScroll: true });
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const hasSearchModifier = usesMetaShortcut
      ? event.metaKey && !event.ctrlKey
      : event.ctrlKey && !event.metaKey;
    if (
      hasSearchModifier &&
      !event.altKey &&
      !event.shiftKey &&
      event.key.toLocaleLowerCase() === "f"
    ) {
      event.preventDefault();
      focusLibrarySearch();
    } else if (
      event.key === "/" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !isEditableTarget(event.target)
    ) {
      event.preventDefault();
      focusLibrarySearch();
    } else if (event.key === "Escape" || (event.altKey && event.key === "2")) {
      event.preventDefault();
      void capture.close();
    } else if (
      event.key === "Enter" &&
      (event.ctrlKey || event.metaKey) &&
      !isSaving
    ) {
      event.preventDefault();
      void capture.promote();
    } else if (
      event.key.toLocaleLowerCase() === "n" &&
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !event.shiftKey &&
      capture.activeId &&
      !isSaving
    ) {
      event.preventDefault();
      void capture.openDraft();
    } else if (
      event.key.toLocaleLowerCase() === "p" &&
      (event.ctrlKey || event.metaKey) &&
      event.shiftKey &&
      !event.altKey &&
      capture.activeId &&
      !isSaving
    ) {
      event.preventDefault();
      capture.setPinned(!capture.pinned);
    } else if (
      event.key.toLocaleLowerCase() === "d" &&
      (event.ctrlKey || event.metaKey) &&
      event.shiftKey &&
      capture.activeId &&
      !isSaving
    ) {
      event.preventDefault();
      void capture.duplicateActive();
    }
  };

  const handleLibrarySearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (query || tagFilter) {
        setQuery("");
        setTagFilter(null);
        setLibraryCursorId(capture.notes[0]?.id ?? null);
      } else {
        librarySearchRef.current?.blur();
      }
      return;
    }

    if (filteredNotes.length === 0) return;
    const currentIndex = Math.max(
      0,
      filteredNotes.findIndex((note) => note.id === libraryCursorNote?.id),
    );
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % filteredNotes.length;
    } else if (event.key === "ArrowUp") {
      nextIndex =
        (currentIndex - 1 + filteredNotes.length) % filteredNotes.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = filteredNotes.length - 1;
    } else if (event.key === "PageDown") {
      nextIndex = Math.min(
        filteredNotes.length - 1,
        currentIndex + QUICK_CAPTURE_PAGE_STEP,
      );
    } else if (event.key === "PageUp") {
      nextIndex = Math.max(0, currentIndex - QUICK_CAPTURE_PAGE_STEP);
    } else if (event.key === "Enter" && libraryCursorNote) {
      event.preventDefault();
      event.stopPropagation();
      librarySearchRef.current?.blur();
      void capture.selectNote(libraryCursorNote);
      return;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    event.stopPropagation();
    setLibraryCursorId(filteredNotes[nextIndex]?.id ?? null);
  };

  const pasteClipboard = async () => {
    try {
      const value = await navigator.clipboard.readText();
      if (!value) {
        setActionStatus("クリップボードが空です");
        return;
      }
      const textarea = editorRef.current;
      const start = textarea?.selectionStart ?? capture.content.length;
      const end = textarea?.selectionEnd ?? start;
      capture.setContent(
        `${capture.content.slice(0, start)}${value}${capture.content.slice(end)}`,
      );
      setActionStatus("貼り付けました");
      requestAnimationFrame(() => {
        textarea?.focus();
        textarea?.setSelectionRange(start + value.length, start + value.length);
      });
    } catch {
      setActionStatus("クリップボードを読み取れませんでした");
    }
  };

  const copyClipboard = async () => {
    try {
      await navigator.clipboard.writeText(capture.content);
      setActionStatus("クリップボードへコピーしました");
    } catch {
      setActionStatus("クリップボードへコピーできませんでした");
    }
  };

  const copySavedNote = async (note: QuickCaptureNote) => {
    try {
      await navigator.clipboard.writeText(note.content);
      setActionStatus("メモをクリップボードへコピーしました");
    } catch {
      setActionStatus("メモをコピーできませんでした");
    }
  };

  const exportMarkdown = async () => {
    try {
      const path = await capture.withAutoHideSuspended(() =>
        save({
          title: "Markdownとして書き出す",
          defaultPath: safeFileName(noteTitle({ content: capture.content })),
          filters: [{ name: "Markdown", extensions: ["md"] }],
        }),
      );
      if (!path) return;
      await exportQuickCaptureMarkdown({
        path,
        content: capture.content,
        tags: parseTags(capture.tags),
      });
      setActionStatus("Markdownを書き出しました");
    } catch (reason) {
      setActionStatus(
        reason instanceof Error ? reason.message : "書き出しに失敗しました",
      );
    }
  };

  const exportBackup = async () => {
    try {
      const path = await capture.withAutoHideSuspended(() =>
        chooseQuickCaptureBackupForSave(),
      );
      if (path) await capture.exportBackup(path);
    } catch (reason) {
      setActionStatus(
        reason instanceof Error ? reason.message : "バックアップに失敗しました",
      );
    }
  };

  const requestImportBackup = async () => {
    try {
      const path = await capture.withAutoHideSuspended(() =>
        chooseQuickCaptureBackupForOpen(),
      );
      if (path && !Array.isArray(path)) {
        setConfirmationError("");
        setConfirmation({ kind: "import", path });
      }
    } catch (reason) {
      setActionStatus(
        reason instanceof Error ? reason.message : "復元に失敗しました",
      );
    }
  };

  const confirmDestructiveAction = async () => {
    if (!confirmation) return;
    setConfirmationBusy(true);
    setConfirmationError("");
    const operationError =
      confirmation.kind === "delete"
        ? await capture.removeNote(confirmation.note.id)
        : await capture.importBackup(confirmation.path);
    if (operationError) {
      setConfirmationError(operationError);
    } else {
      setConfirmation(null);
    }
    setConfirmationBusy(false);
  };

  const themeColor =
    settings?.quickCapture.themeColor ||
    defaultAppSettings.quickCapture.themeColor;

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
            onCopyClipboard={() => void copyClipboard()}
            onExportMarkdown={() => void exportMarkdown()}
            onRequestDelete={() => {
              setConfirmationError("");
              if (activeNote) {
                setConfirmation({ kind: "delete", note: activeNote });
              }
            }}
          />
          <QuickCaptureLibrary
            notes={capture.notes}
            filteredNotes={filteredNotes}
            activeId={capture.activeId}
            allTags={capture.allTags}
            pinnedCount={pinnedCount}
            query={query}
            tagFilter={tagFilter}
            pinnedOnly={pinnedOnly}
            cursorNote={libraryCursorNote}
            searchFocused={librarySearchFocused}
            searchRef={librarySearchRef}
            noteListRef={noteListRef}
            noteListId={noteListId}
            shortcutModifier={shortcutModifier}
            usesMetaShortcut={usesMetaShortcut}
            onExportBackup={() => void exportBackup()}
            onImportBackup={() => void requestImportBackup()}
            onSearchFocus={() => {
              librarySearchFocusedRef.current = true;
              setLibrarySearchFocused(true);
              setLibraryCursorId(
                libraryCursorNote?.id ?? filteredNotes[0]?.id ?? null,
              );
            }}
            onSearchBlur={() => {
              librarySearchFocusedRef.current = false;
              setLibrarySearchFocused(false);
            }}
            onQueryChange={(value) => {
              setQuery(value);
              setLibraryCursorId(null);
            }}
            onSearchKeyDown={handleLibrarySearchKeyDown}
            onClearFilters={() => {
              setPinnedOnly(false);
              setTagFilter(null);
              setLibraryCursorId(null);
            }}
            onTogglePinnedOnly={() => {
              setPinnedOnly((value) => !value);
              setLibraryCursorId(null);
            }}
            onToggleTag={(tag) => {
              setTagFilter(tagFilter === tag ? null : tag);
              setLibraryCursorId(null);
            }}
            onCursorChange={setLibraryCursorId}
            onSelectNote={(note) => {
              setLibraryCursorId(note.id);
              void capture.selectNote(note);
            }}
            onCopyNote={(note) => void copySavedNote(note)}
            onRequestDelete={(note) => {
              setConfirmationError("");
              setConfirmation({ kind: "delete", note });
            }}
          />
        </main>
      </OverlayCard>
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
            : `「${confirmation?.kind === "delete" ? noteTitle(confirmation.note) : "このメモ"}」を削除します。添付ファイルも削除され、この操作は取り消せません。`
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
        onCancel={() => {
          setConfirmation(null);
          setConfirmationError("");
        }}
        onConfirm={() => void confirmDestructiveAction()}
      />
    </OverlayFrame>
  );
};
