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
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { OverlayCard, OverlayFrame } from "../../../design/layout";
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

export const QuickCaptureOverlay: React.FC = () => {
  const capture = useQuickCapture();
  const [preview, setPreview] = useState(false);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState("");
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLElement | null>(null);
  const { focusSequence } = capture;
  const isSaving = capture.status === "saving";
  const activeNote = capture.activeId
    ? capture.notes.find((note) => note.id === capture.activeId)
    : null;

  useEffect(() => {
    void focusSequence;
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

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape" || (event.altKey && event.key === "2")) {
      event.preventDefault();
      void capture.close();
    } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void capture.promote();
    }
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

  const importBackup = async () => {
    try {
      if (!window.confirm("現在の下書きと保存済みメモを置き換えますか？"))
        return;
      const path = await chooseQuickCaptureBackupForOpen();
      if (path && !Array.isArray(path)) await capture.importBackup(path);
    } catch (reason) {
      setActionStatus(
        reason instanceof Error ? reason.message : "復元に失敗しました",
      );
    }
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
                      if (window.confirm("このメモを削除しますか？"))
                        void capture.removeActive();
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
                    <kbd>Ctrl ↵</kbd>
                  </button>
                )}
              </div>
            </footer>
          </section>

          <aside className="quick-capture__library" aria-label="保存済みメモ">
            <div className="quick-capture__library-header">
              <strong>
                <Archive size={14} aria-hidden="true" /> 保存済みメモ
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
                  onClick={() => void importBackup()}
                >
                  <Upload size={13} aria-hidden="true" />
                </button>
              </div>
            </div>
            <label className="quick-capture__search">
              <Search size={14} aria-hidden="true" />
              <input
                aria-label="保存済みメモを検索"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="メモを検索"
              />
            </label>
            {capture.allTags.length > 0 && (
              <div className="quick-capture__tag-filters">
                {capture.allTags.map((tag) => (
                  <button
                    type="button"
                    key={tag}
                    className={tagFilter === tag ? "is-active" : ""}
                    aria-pressed={tagFilter === tag}
                    onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
            <div className="quick-capture__notes">
              {filteredNotes.length ? (
                filteredNotes.map((note) => (
                  <button
                    type="button"
                    key={note.id}
                    className={`quick-capture__note${capture.activeId === note.id ? " is-active" : ""}`}
                    aria-current={
                      capture.activeId === note.id ? "true" : undefined
                    }
                    onClick={() => void capture.selectNote(note)}
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
    </OverlayFrame>
  );
};
