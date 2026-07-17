import {
  Copy,
  ExternalLink,
  Eye,
  FolderSearch,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import type React from "react";
import type { FileShelfController } from "../hooks/useFileShelf";
import type { FileShelfItem } from "../types";

interface FileShelfSelectionActionsProps {
  shelf: FileShelfController;
  selectedItems: FileShelfItem[];
  removableSelectedItems: FileShelfItem[];
  onStartRenaming: (item: FileShelfItem) => void;
  onTogglePreview: (item: FileShelfItem) => void;
}

export const FileShelfSelectionActions: React.FC<
  FileShelfSelectionActionsProps
> = ({
  shelf,
  selectedItems,
  removableSelectedItems,
  onStartRenaming,
  onTogglePreview,
}) => {
  if (selectedItems.length === 0) return null;
  const allPinned = selectedItems.every((item) => item.pinned);
  const singleItem = selectedItems.length === 1 ? selectedItems[0] : null;
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
    </div>
  );
};
