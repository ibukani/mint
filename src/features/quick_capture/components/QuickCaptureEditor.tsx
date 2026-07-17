import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import {
  Check,
  ClipboardPaste,
  ClipboardPlus,
  Copy,
  Download,
  Edit3,
  Eye,
  Paperclip,
  Pin,
  RefreshCw,
  Tag,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import type { RefObject } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { useQuickCapture } from "../hooks/useQuickCapture";
import type { QuickCaptureNote } from "../types";

type QuickCaptureController = ReturnType<typeof useQuickCapture>;

interface QuickCaptureEditorProps {
  capture: QuickCaptureController;
  preview: boolean;
  previewRef: RefObject<HTMLElement | null>;
  editorRef: RefObject<HTMLTextAreaElement | null>;
  shortcutModifier: string;
  actionStatus: string;
  isSaving: boolean;
  activeNote: QuickCaptureNote | null;
  onSetPreview: (preview: boolean) => void;
  onPasteClipboard: () => void;
  onCaptureClipboard: () => void;
  onCopyClipboard: () => void;
  onExportMarkdown: () => void;
  onRequestDelete: () => void;
}

export const QuickCaptureEditor = ({
  capture,
  preview,
  previewRef,
  editorRef,
  shortcutModifier,
  actionStatus,
  isSaving,
  activeNote,
  onSetPreview,
  onPasteClipboard,
  onCaptureClipboard,
  onCopyClipboard,
  onExportMarkdown,
  onRequestDelete,
}: QuickCaptureEditorProps) => (
  <section
    className={`quick-capture__editor-pane${capture.isDropTarget ? " is-drop-target" : ""}`}
    aria-label="メモ編集"
  >
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
          onClick={() => onSetPreview(false)}
        >
          <Edit3 size={14} aria-hidden="true" /> 編集
        </button>
        <button
          type="button"
          className={preview ? "is-active" : ""}
          aria-pressed={preview}
          aria-controls="quick-capture-content"
          onClick={() => onSetPreview(true)}
        >
          <Eye size={14} aria-hidden="true" /> プレビュー
        </button>
      </fieldset>
      <div className="quick-capture__toolbar-actions">
        <button
          type="button"
          className="quick-capture__toolbar-button"
          onClick={onPasteClipboard}
          title="クリップボードから貼り付け"
        >
          <ClipboardPaste size={14} aria-hidden="true" /> 貼り付け
        </button>
        <button
          type="button"
          className="quick-capture__toolbar-button"
          disabled={isSaving}
          onClick={onCaptureClipboard}
          title="クリップボードの本文を新しいメモとして保存"
        >
          <ClipboardPlus size={14} aria-hidden="true" /> 即保存
        </button>
        {capture.content.trim() && (
          <>
            <button
              type="button"
              className="quick-capture__toolbar-button"
              onClick={onCopyClipboard}
              title="本文をクリップボードへコピー"
            >
              <Copy size={14} aria-hidden="true" /> コピー
            </button>
            <button
              type="button"
              className="quick-capture__toolbar-button"
              onClick={onExportMarkdown}
              title="Markdownとして書き出し"
            >
              <Download size={14} aria-hidden="true" /> 書き出し
            </button>
          </>
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
              aria-keyshortcuts="Control+Shift+P Meta+Shift+P"
              title={`ピン留めを切り替え（${shortcutModifier}+Shift+P）`}
              onClick={() => capture.setPinned(!capture.pinned)}
            >
              <Pin size={14} aria-hidden="true" /> ピン留め
            </button>
          </>
        )}
      </div>
    </div>

    {capture.isDropTarget && (
      <div className="quick-capture__drop-overlay" role="status">
        <Paperclip size={24} aria-hidden="true" />
        <strong>ここにドロップしてファイルを添付</strong>
        <span>複数ファイルにも対応しています</span>
      </div>
    )}

    <div className="quick-capture__writing-surface">
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
          placeholder="何を残しておきますか？"
          spellCheck="true"
        />
      )}

      <label className="quick-capture__tags-input">
        <Tag size={14} aria-hidden="true" />
        <input
          aria-label="タグ"
          value={capture.tags}
          onChange={(event) => capture.setTags(event.target.value)}
          placeholder="タグを追加（カンマ区切り）"
        />
      </label>
    </div>

    {activeNote && activeNote.attachments.length > 0 && (
      <section className="quick-capture__attachments" aria-label="添付ファイル">
        <div className="quick-capture__attachments-heading">
          <span>
            <Paperclip size={13} aria-hidden="true" /> 添付ファイル
          </span>
          <small>{activeNote.attachments.length}件</small>
        </div>
        <div className="quick-capture__attachment-list">
          {activeNote.attachments.map((attachment) => (
            <div className="quick-capture__attachment" key={attachment.id}>
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
                onClick={() => void capture.removeAttachment(attachment.id)}
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
        {capture.canUndoDelete && (
          <button
            type="button"
            className="quick-capture__undo"
            disabled={isSaving}
            onClick={() => void capture.undoDelete()}
            title="直前に削除したメモを復元"
          >
            <Undo2 size={14} aria-hidden="true" /> 削除を取り消す
          </button>
        )}
        {capture.error &&
          (capture.canRetrySave || capture.canRetryDuplicate) && (
            <button
              type="button"
              className="quick-capture__retry"
              disabled={isSaving}
              onClick={() =>
                void (capture.canRetryDuplicate
                  ? capture.retryDuplicate()
                  : capture.retrySave())
              }
              title={
                capture.canRetryDuplicate ? "複製を再試行" : "保存を再試行"
              }
            >
              <RefreshCw size={14} aria-hidden="true" />
              {capture.canRetryDuplicate ? "複製を再試行" : "再試行"}
            </button>
          )}
        {capture.activeId && (
          <button
            type="button"
            className="quick-capture__danger"
            disabled={isSaving}
            onClick={onRequestDelete}
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
);
