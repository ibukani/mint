import { save } from "@tauri-apps/plugin-dialog";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import Fuse from "fuse.js";
import {
  Archive,
  Check,
  ClipboardPaste,
  Download,
  Edit3,
  Eye,
  FileText,
  Paperclip,
  Pin,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type React from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
import "./QuickCaptureOverlay.css";

export const noteTitle = (note: Pick<QuickCaptureNote, "content">) =>
  note.content
    .split("\n")
    .find((line) => line.trim())
    ?.trim() || "無題のメモ";

const formatUpdatedAt = (value: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const parseTags = (value: string) =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

const safeFileName = (value: string) =>
  `${value.replace(/[\\/:*?"<>|]+/g, "-").trim() || "quick-capture"}.md`;

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement && target.isContentEditable);

type QuickCaptureConfirmation =
  | { kind: "delete" }
  | { kind: "import"; path: string };

export const QuickCaptureOverlay: React.FC = () => {
  const capture = useQuickCapture();
  const [preview, setPreview] = useState(false);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
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
    ? capture.notes.find((note) => note.id === capture.activeId)
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
    setActionStatus("");
  }, [capture.activeId, focusSequence]);

  const filteredNotes = useMemo(() => {
    const tagged = tagFilter
      ? capture.notes.filter((note) => note.tags.includes(tagFilter))
      : capture.notes;
    if (!query.trim()) return tagged;
    return new Fuse(tagged, {
      keys: ["content", "tags"],
      threshold: 0.35,
      ignoreLocation: true,
    })
      .search(query)
      .map((result) => result.item);
  }, [capture.notes, query, tagFilter]);
  const libraryCursorNote =
    filteredNotes.find((note) => note.id === libraryCursorId) ??
    filteredNotes[0] ??
    null;

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
    }
  };

  const handleLibrarySearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Escape" && (query || tagFilter)) {
      event.preventDefault();
      event.stopPropagation();
      setQuery("");
      setTagFilter(null);
      setLibraryCursorId(capture.notes[0]?.id ?? null);
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

  const exportMarkdown = async () => {
    try {
      const path = await save({
        title: "Markdownとして書き出す",
        defaultPath: safeFileName(noteTitle({ content: capture.content })),
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
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
      const path = await chooseQuickCaptureBackupForSave();
      if (path) await capture.exportBackup(path);
    } catch (reason) {
      setActionStatus(
        reason instanceof Error ? reason.message : "バックアップに失敗しました",
      );
    }
  };

  const requestImportBackup = async () => {
    try {
      const path = await chooseQuickCaptureBackupForOpen();
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
        ? await capture.removeActive()
        : await capture.importBackup(confirmation.path);
    if (operationError) {
      setConfirmationError(operationError);
    } else {
      setConfirmation(null);
    }
    setConfirmationBusy(false);
  };

  return (
    <OverlayFrame>
      <OverlayCard
        className="quick-capture is-visible"
        role="dialog"
        aria-label="クイックキャプチャー"
        onKeyDown={handleKeyDown}
      >
        <header className="quick-capture__header">
          <div className="quick-capture__heading">
            <FileText size={18} aria-hidden="true" />
            <div>
              <h1>
                {capture.activeId
                  ? noteTitle({ content: capture.content })
                  : "Quick Capture"}
              </h1>
              <span>
                {capture.activeId ? "保存済みメモ" : "自動保存される下書き"}
              </span>
            </div>
          </div>
          <div className="quick-capture__header-actions">
            {capture.activeId && (
              <button type="button" onClick={() => void capture.openDraft()}>
                下書きへ
              </button>
            )}
            <button
              type="button"
              className="quick-capture__icon-button"
              aria-label="クイックキャプチャーを閉じる"
              aria-keyshortcuts="Escape Alt+2"
              title="閉じる（Esc）"
              onClick={() => void capture.close()}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </header>

        <main className="quick-capture__body">
          <section className="quick-capture__editor-pane" aria-label="メモ編集">
            <div className="quick-capture__toolbar">
              <fieldset
                className="quick-capture__mode-switch"
                aria-label="メモの表示モード"
              >
                <button
                  type="button"
                  className={!preview ? "is-active" : ""}
                  aria-pressed={!preview}
                  aria-controls="quick-capture-content"
                  onClick={() => setPreview(false)}
                >
                  <Edit3 size={14} aria-hidden="true" /> 編集
                </button>
                <button
                  type="button"
                  className={preview ? "is-active" : ""}
                  aria-pressed={preview}
                  aria-controls="quick-capture-content"
                  onClick={() => setPreview(true)}
                >
                  <Eye size={14} aria-hidden="true" /> プレビュー
                </button>
              </fieldset>
              <div className="quick-capture__toolbar-actions">
                <button
                  type="button"
                  className="quick-capture__toolbar-button"
                  onClick={() => void pasteClipboard()}
                  title="クリップボードから貼り付け"
                >
                  <ClipboardPaste size={14} aria-hidden="true" /> 貼り付け
                </button>
                {capture.content.trim() && (
                  <button
                    type="button"
                    className="quick-capture__toolbar-button"
                    onClick={() => void exportMarkdown()}
                    title="Markdownとして書き出し"
                  >
                    <Download size={14} aria-hidden="true" /> 書き出し
                  </button>
                )}
                {capture.activeId && (
                  <>
                    <button
                      type="button"
                      className="quick-capture__toolbar-button"
                      disabled={isSaving}
                      onClick={() => void capture.addAttachment()}
                      title="ファイルを添付"
                    >
                      <Paperclip size={14} aria-hidden="true" /> 添付
                    </button>
                    <button
                      type="button"
                      className={`quick-capture__pin${capture.pinned ? " is-active" : ""}`}
                      aria-pressed={capture.pinned}
                      onClick={() => capture.setPinned(!capture.pinned)}
                    >
                      <Pin size={14} aria-hidden="true" /> ピン留め
                    </button>
                  </>
                )}
              </div>
            </div>

            {preview ? (
              <article
                ref={previewRef}
                id="quick-capture-content"
                className="quick-capture__preview"
                tabIndex={-1}
                aria-label="メモのプレビュー"
              >
                {capture.content.trim() ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          onClick={(event) => {
                            event.preventDefault();
                            if (href) void openUrl(href);
                          }}
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {capture.content}
                  </ReactMarkdown>
                ) : (
                  <p className="quick-capture__empty">
                    プレビューする内容がありません。
                  </p>
                )}
              </article>
            ) : (
              <textarea
                ref={editorRef}
                id="quick-capture-content"
                aria-label="メモ本文"
                value={capture.content}
                onChange={(event) => capture.setContent(event.target.value)}
                placeholder="ここに書き始める…"
                spellCheck="true"
              />
            )}

            <label className="quick-capture__tags-input">
              <Tag size={14} aria-hidden="true" />
              <input
                aria-label="タグ"
                value={capture.tags}
                onChange={(event) => capture.setTags(event.target.value)}
                placeholder="タグをカンマ区切りで追加"
              />
            </label>

            {activeNote && activeNote.attachments.length > 0 && (
              <section
                className="quick-capture__attachments"
                aria-label="添付ファイル"
              >
                <div className="quick-capture__attachments-heading">
                  <span>
                    <Paperclip size={13} aria-hidden="true" /> 添付ファイル
                  </span>
                  <small>{activeNote.attachments.length}件</small>
                </div>
                <div className="quick-capture__attachment-list">
                  {activeNote.attachments.map((attachment) => (
                    <div
                      className="quick-capture__attachment"
                      key={attachment.id}
                    >
                      <button
                        type="button"
                        className="quick-capture__attachment-link"
                        onClick={() => void openPath(attachment.storedPath)}
                        title="既定のアプリで開く"
                      >
                        <strong>{attachment.fileName}</strong>
                        <small>
                          {attachment.sizeBytes
                            ? `${Math.ceil(attachment.sizeBytes / 1024)}KB`
                            : "添付済み"}
                        </small>
                      </button>
                      <button
                        type="button"
                        className="quick-capture__attachment-remove"
                        aria-label={`${attachment.fileName}を削除`}
                        disabled={isSaving}
                        onClick={() =>
                          void capture.removeAttachment(attachment.id)
                        }
                      >
                        <X size={13} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <footer className="quick-capture__editor-footer">
              <span
                className={capture.status === "error" ? "is-error" : ""}
                role={capture.error ? "alert" : "status"}
                aria-live="polite"
              >
                {capture.error ||
                  actionStatus ||
                  (capture.status === "saving"
                    ? "保存中…"
                    : capture.status === "saved"
                      ? "保存済み"
                      : "")}
              </span>
              <div>
                {capture.canRetrySave && capture.error && (
                  <button
                    type="button"
                    className="quick-capture__retry"
                    disabled={isSaving}
                    onClick={() => void capture.retrySave()}
                    title="保存を再試行"
                  >
                    <RefreshCw size={14} aria-hidden="true" /> 再試行
                  </button>
                )}
                {capture.activeId && (
                  <button
                    type="button"
                    className="quick-capture__danger"
                    disabled={isSaving}
                    onClick={() => {
                      setConfirmationError("");
                      setConfirmation({ kind: "delete" });
                    }}
                  >
                    <Trash2 size={14} aria-hidden="true" /> 削除
                  </button>
                )}
                {!capture.activeId && (
                  <button
                    type="button"
                    className="quick-capture__save"
                    disabled={!capture.content.trim() || isSaving}
                    aria-keyshortcuts="Control+Enter Meta+Enter"
                    onClick={() => void capture.promote()}
                  >
                    <Check size={14} aria-hidden="true" /> メモに保存{" "}
                    <kbd>{shortcutModifier} ↵</kbd>
                  </button>
                )}
              </div>
            </footer>
          </section>

          <aside className="quick-capture__library" aria-label="保存済みメモ">
            <div className="quick-capture__library-header">
              <strong>
                <Archive size={14} aria-hidden="true" /> 保存済みメモ
                <span className="quick-capture__library-count">
                  {capture.notes.length}
                </span>
              </strong>
              <div>
                <button
                  type="button"
                  aria-label="バックアップを書き出す"
                  title="バックアップを書き出す"
                  onClick={() => void exportBackup()}
                >
                  <Download size={13} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="バックアップから復元する"
                  title="バックアップから復元する"
                  onClick={() => void requestImportBackup()}
                >
                  <Upload size={13} aria-hidden="true" />
                </button>
              </div>
            </div>
            <label className="quick-capture__search">
              <Search size={14} aria-hidden="true" />
              <input
                ref={librarySearchRef}
                role="combobox"
                aria-label="保存済みメモを検索"
                aria-controls={noteListId}
                aria-expanded="true"
                aria-autocomplete="list"
                aria-haspopup="listbox"
                aria-activedescendant={
                  librarySearchFocused && libraryCursorNote
                    ? `${noteListId}-${libraryCursorNote.id}`
                    : undefined
                }
                aria-keyshortcuts={
                  usesMetaShortcut ? "Meta+F /" : "Control+F /"
                }
                value={query}
                onFocus={() => {
                  librarySearchFocusedRef.current = true;
                  setLibrarySearchFocused(true);
                  setLibraryCursorId(
                    libraryCursorNote?.id ?? filteredNotes[0]?.id ?? null,
                  );
                }}
                onBlur={() => {
                  librarySearchFocusedRef.current = false;
                  setLibrarySearchFocused(false);
                }}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setLibraryCursorId(null);
                }}
                onKeyDown={handleLibrarySearchKeyDown}
                placeholder="メモを検索"
              />
              <kbd className="quick-capture__search-shortcut">
                {shortcutModifier} F
              </kbd>
            </label>
            {capture.allTags.length > 0 && (
              <div className="quick-capture__tag-filters">
                {capture.allTags.map((tag) => (
                  <button
                    type="button"
                    key={tag}
                    className={tagFilter === tag ? "is-active" : ""}
                    aria-pressed={tagFilter === tag}
                    onClick={() => {
                      setTagFilter(tagFilter === tag ? null : tag);
                      setLibraryCursorId(null);
                    }}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
            <div
              id={noteListId}
              ref={noteListRef}
              className="quick-capture__notes"
              role="listbox"
              aria-label="保存済みメモ"
            >
              {filteredNotes.length ? (
                filteredNotes.map((note) => (
                  <button
                    type="button"
                    role="option"
                    id={`${noteListId}-${note.id}`}
                    key={note.id}
                    tabIndex={-1}
                    className={`quick-capture__note${capture.activeId === note.id ? " is-active" : ""}${librarySearchFocused && libraryCursorNote?.id === note.id ? " is-keyboard-active" : ""}`}
                    aria-selected={capture.activeId === note.id}
                    onMouseEnter={() => setLibraryCursorId(note.id)}
                    onClick={() => {
                      setLibraryCursorId(note.id);
                      void capture.selectNote(note);
                    }}
                  >
                    <span className="quick-capture__note-title">
                      {note.pinned && (
                        <Pin size={11} aria-label="ピン留め済み" />
                      )}
                      <strong>{noteTitle(note)}</strong>
                    </span>
                    <small>{formatUpdatedAt(note.updatedAt)}</small>
                    {note.tags.length > 0 && (
                      <span>{note.tags.map((tag) => `#${tag}`).join(" ")}</span>
                    )}
                  </button>
                ))
              ) : (
                <div className="quick-capture__empty">
                  {query || tagFilter
                    ? "一致するメモがありません"
                    : "保存したメモがここに並びます"}
                </div>
              )}
            </div>
          </aside>
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
            : `「${activeNote ? noteTitle(activeNote) : "このメモ"}」を削除します。添付ファイルも削除され、この操作は取り消せません。`
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
