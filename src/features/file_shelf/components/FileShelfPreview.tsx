import { Copy, ExternalLink, LoaderCircle, Pin, PinOff, X } from "lucide-react";
import type { RefObject } from "react";
import type { FileShelfItem } from "../types";
import { kindLabel } from "../utils";
import { FileShelfItemIcon } from "./FileShelfItemIcon";

interface FileShelfPreviewProps {
  item: FileShelfItem;
  pinned: boolean;
  dataUrl: string | null;
  loading: boolean;
  error: string;
  closeRef: RefObject<HTMLButtonElement | null>;
  onTogglePinned: () => void;
  onClose: () => void;
  onCopy: (item: FileShelfItem) => void;
  onOpen: (item: FileShelfItem) => void;
}

export const FileShelfPreview = ({
  item,
  pinned,
  dataUrl,
  loading,
  error,
  closeRef,
  onTogglePinned,
  onClose,
  onCopy,
  onOpen,
}: FileShelfPreviewProps) => (
  <aside
    className="file-shelf__preview"
    role="dialog"
    aria-label={`${item.displayName}のクイックプレビュー`}
  >
    <header className="file-shelf__preview-header">
      <div className="file-shelf__preview-title">
        <FileShelfItemIcon
          className="file-shelf__preview-icon"
          kind={item.kind}
        />
        <span>
          <strong>{item.displayName}</strong>
          <small>
            {pinned ? "プレビュー固定 · " : ""}
            {item.pinned ? "固定 · " : ""}
            {kindLabel[item.kind]}
          </small>
        </span>
      </div>
      <div className="file-shelf__preview-header-actions">
        <button
          type="button"
          className={pinned ? "is-active" : undefined}
          onClick={onTogglePinned}
          aria-label={
            pinned
              ? "クイックプレビューの固定を解除"
              : "クイックプレビューを固定"
          }
          aria-pressed={pinned}
          title={pinned ? "固定を解除（P）" : "固定する（P）"}
        >
          {pinned ? (
            <PinOff size={16} aria-hidden="true" />
          ) : (
            <Pin size={16} aria-hidden="true" />
          )}
        </button>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="クイックプレビューを閉じる"
          title="閉じる（Esc）"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </header>
    <div className="file-shelf__preview-body">
      {loading ? (
        <div className="file-shelf__preview-state">
          <LoaderCircle className="is-spinning" size={28} aria-hidden="true" />
          画像を読み込んでいます…
        </div>
      ) : error ? (
        <div className="file-shelf__preview-state is-error">
          <FileShelfItemIcon
            className="file-shelf__preview-hero-icon"
            kind={item.kind}
          />
          {error}
        </div>
      ) : dataUrl ? (
        <img src={dataUrl} alt={item.displayName} />
      ) : item.textContent ? (
        <pre>{item.textContent}</pre>
      ) : (
        <div className="file-shelf__preview-state">
          <FileShelfItemIcon
            className="file-shelf__preview-hero-icon"
            kind={item.kind}
          />
          <strong>{item.displayName}</strong>
          <span>
            {item.availability === "missing"
              ? "元の場所に見つかりません"
              : item.sourcePath || "内容プレビューはありません"}
          </span>
        </div>
      )}
    </div>
    <footer className="file-shelf__preview-actions">
      <span>Pで固定 · Q / Escで閉じる</span>
      <button type="button" onClick={() => onCopy(item)}>
        <Copy size={14} aria-hidden="true" />
        コピー
      </button>
      {(item.sourcePath || item.kind === "url") && (
        <button type="button" onClick={() => onOpen(item)}>
          <ExternalLink size={14} aria-hidden="true" />
          開く
        </button>
      )}
    </footer>
  </aside>
);
