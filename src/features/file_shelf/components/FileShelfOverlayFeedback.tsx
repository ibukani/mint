import { CheckCircle2, RotateCcw, Trash2 } from "lucide-react";
import type React from "react";
import type { FileShelfController } from "../hooks/useFileShelf";

interface FileShelfOverlayFeedbackProps {
  shelf: FileShelfController;
  editing: boolean;
}

export const FileShelfOverlayFeedback: React.FC<
  FileShelfOverlayFeedbackProps
> = ({ shelf, editing }) => (
  <>
    {shelf.pendingDragCount > 0 && !editing && (
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
          <RotateCcw size={14} aria-hidden="true" /> 元に戻す
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
  </>
);
