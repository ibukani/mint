import { openUrl } from "@tauri-apps/plugin-opener";
import Fuse from "fuse.js";
import {
  Check,
  Edit3,
  Eye,
  FileText,
  Pin,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { OverlayCard, OverlayFrame } from "../../../design/layout";
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

export const QuickCaptureOverlay: React.FC = () => {
  const capture = useQuickCapture();
  const [preview, setPreview] = useState(false);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const { focusSequence } = capture;

  useEffect(() => {
    void focusSequence;
    editorRef.current?.focus();
    const length = editorRef.current?.value.length ?? 0;
    editorRef.current?.setSelectionRange(length, length);
  }, [focusSequence]);

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

  return (
    <OverlayFrame>
      <OverlayCard
        className="quick-capture"
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
              onClick={() => void capture.close()}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </header>

        <main className="quick-capture__body">
          <section className="quick-capture__editor-pane" aria-label="メモ編集">
            <div className="quick-capture__toolbar">
              <div className="quick-capture__mode-switch">
                <button
                  type="button"
                  className={!preview ? "is-active" : ""}
                  onClick={() => setPreview(false)}
                >
                  <Edit3 size={14} aria-hidden="true" /> 編集
                </button>
                <button
                  type="button"
                  className={preview ? "is-active" : ""}
                  onClick={() => setPreview(true)}
                >
                  <Eye size={14} aria-hidden="true" /> プレビュー
                </button>
              </div>
              {capture.activeId && (
                <button
                  type="button"
                  className={`quick-capture__pin${capture.pinned ? " is-active" : ""}`}
                  aria-pressed={capture.pinned}
                  onClick={() => capture.setPinned(!capture.pinned)}
                >
                  <Pin size={14} aria-hidden="true" /> ピン留め
                </button>
              )}
            </div>

            {preview ? (
              <article className="quick-capture__preview">
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

            <footer className="quick-capture__editor-footer">
              <span
                className={capture.status === "error" ? "is-error" : ""}
                aria-live="polite"
              >
                {capture.error ??
                  (capture.status === "saving"
                    ? "保存中…"
                    : capture.status === "saved"
                      ? "保存済み"
                      : "")}
              </span>
              <div>
                {capture.activeId && (
                  <button
                    type="button"
                    className="quick-capture__danger"
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
                    disabled={!capture.content.trim()}
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
            <label className="quick-capture__search">
              <Search size={14} aria-hidden="true" />
              <input
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
