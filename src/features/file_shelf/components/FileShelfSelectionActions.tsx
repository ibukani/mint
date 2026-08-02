import {
  AudioLines,
  Copy,
  ExternalLink,
  Eye,
  FolderSearch,
  Pencil,
  Pin,
  PinOff,
  Save,
  Trash2,
} from "lucide-react";
import type React from "react";
import type { ActionPorts } from "../../../core/actions/ports";
import { useCrossFeatureActions } from "../../../core/actions/useCrossFeatureActions";
import { calendarPort } from "../../calendar/ports";
import { quickCapturePort } from "../../quick_capture/ports";
import { voiceToTextPort } from "../../v2t/ports";
import type { FileShelfController } from "../hooks/useFileShelf";
import { fileShelfPort } from "../ports";
import type { FileShelfItem } from "../types";

interface FileShelfSelectionActionsProps {
  shelf: FileShelfController;
  selectedItems: FileShelfItem[];
  removableSelectedItems: FileShelfItem[];
  onStartRenaming: (item: FileShelfItem) => void;
  onTogglePreview: (item: FileShelfItem) => void;
}

const composePorts = (): ActionPorts => ({
  quickCapture: quickCapturePort,
  voiceToText: voiceToTextPort,
  calendar: calendarPort,
  fileShelf: fileShelfPort,
});

export const FileShelfSelectionActions: React.FC<
  FileShelfSelectionActionsProps
> = ({
  shelf,
  selectedItems,
  removableSelectedItems,
  onStartRenaming,
  onTogglePreview,
}) => {
  const { runAction, runningActionId, feedback } = useCrossFeatureActions(
    composePorts(),
  );
  if (selectedItems.length === 0) return null;
  const allPinned = selectedItems.every((item) => item.pinned);
  const singleItem = selectedItems.length === 1 ? selectedItems[0] : null;
  const canSaveAsNote = singleItem
    ? singleItem.kind === "text" || singleItem.kind === "url"
    : false;
  const canTranscribe = singleItem
    ? singleItem.kind === "file" && Boolean(singleItem.sourcePath)
    : false;
  return (
    <div className="file-shelf__selection-actions">
      <span>{selectedItems.length}件を選択</span>
      {singleItem && (
        <>
          <button
            type="button"
            onClick={() => onStartRenaming(singleItem)}
            aria-label="棚での表示名を変更"
            title="棚での表示名を変更（F2）"
          >
            <Pencil size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onTogglePreview(singleItem)}
            aria-label="選択項目をプレビュー"
            title="クイックプレビュー（Q）"
          >
            <Eye size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => void shelf.copyItem(singleItem)}
            aria-label="選択項目をコピー"
          >
            <Copy size={15} aria-hidden="true" />
          </button>
          {(singleItem.sourcePath || singleItem.kind === "url") && (
            <button
              type="button"
              onClick={() => void shelf.openItem(singleItem)}
              aria-label="選択項目を開く"
            >
              <ExternalLink size={15} aria-hidden="true" />
            </button>
          )}
          {singleItem.sourcePath && (
            <button
              type="button"
              onClick={() => void shelf.revealItem(singleItem)}
              aria-label="Explorerで表示"
            >
              <FolderSearch size={15} aria-hidden="true" />
            </button>
          )}
          {canSaveAsNote && (
            <button
              type="button"
              disabled={runningActionId === "file-shelf:save-as-note"}
              onClick={() =>
                void runAction("file-shelf:save-as-note", {
                  itemId: singleItem.id,
                })
              }
              aria-label="選択項目をメモとして保存"
              title="テキストまたはURLを新しいメモとして保存"
            >
              <Save size={15} aria-hidden="true" />
            </button>
          )}
          {canTranscribe && (
            <button
              type="button"
              disabled={runningActionId === "file-shelf:transcribe-audio"}
              onClick={() =>
                void runAction("file-shelf:transcribe-audio", {
                  itemId: singleItem.id,
                })
              }
              aria-label="選択した音声を文字起こし"
              title="音声ファイルを音声入力へセットして文字起こし"
            >
              <AudioLines size={15} aria-hidden="true" />
            </button>
          )}
        </>
      )}
      <button
        type="button"
        onClick={() => void shelf.pinItems(selectedItems, !allPinned)}
        aria-label={allPinned ? "選択項目の固定を解除" : "選択項目を棚に固定"}
        title={allPinned ? "固定を解除" : "取り出しや全消去後も棚に残す"}
      >
        {allPinned ? (
          <PinOff size={15} aria-hidden="true" />
        ) : (
          <Pin size={15} aria-hidden="true" />
        )}
      </button>
      {selectedItems.length > 1 && (
        <button
          type="button"
          onClick={() => void shelf.copyItems(selectedItems)}
          aria-label="選択項目をコピー"
        >
          <Copy size={15} aria-hidden="true" />
        </button>
      )}
      {removableSelectedItems.length > 0 && (
        <button
          type="button"
          className="is-danger"
          onClick={() =>
            void shelf.removeItems(
              removableSelectedItems.map((item) => item.id),
            )
          }
          aria-label={
            removableSelectedItems.length === selectedItems.length
              ? "選択項目を棚から外す"
              : "固定されていない選択項目を棚から外す"
          }
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      )}
      {feedback && (
        <span
          className={`file-shelf__action-feedback is-${feedback.tone}`}
          role="status"
          aria-live="polite"
        >
          {feedback.message}
        </span>
      )}
    </div>
  );
};
