import {
  Archive,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  GripVertical,
  Plus,
  Search,
} from "lucide-react";
import type { RefObject } from "react";
import type { useFileShelfDragGesture } from "../hooks/useFileShelfDragGesture";
import type { FileShelfGroup, FileShelfItem } from "../types";
import { formatBytes, kindLabel } from "../utils";
import { FileShelfItemIcon } from "./FileShelfItemIcon";

type FileShelfDragController = ReturnType<typeof useFileShelfDragGesture>;

interface FileShelfContentProps {
  visibleGroups: FileShelfGroup[];
  totalGroupCount: number;
  loading: boolean;
  normalizedQuery: string;
  expandedGroups: Set<string>;
  selectedIds: Set<string>;
  cursorKey: string;
  busy: boolean;
  rowDrag: FileShelfDragController;
  contentRef: RefObject<HTMLDivElement | null>;
  onChoosePaths: () => void;
  onChooseFolders: () => void;
  onClearQuery: () => void;
  onToggleGroup: (groupId: string) => void;
  onSelectItem: (item: FileShelfItem, additive: boolean) => void;
  onOpenItem: (item: FileShelfItem) => void;
  onDragItems: (items: FileShelfItem[], shiftKey: boolean) => void;
}

export const FileShelfContent = ({
  visibleGroups,
  totalGroupCount,
  loading,
  normalizedQuery,
  expandedGroups,
  selectedIds,
  cursorKey,
  busy,
  rowDrag,
  contentRef,
  onChoosePaths,
  onChooseFolders,
  onClearQuery,
  onToggleGroup,
  onSelectItem,
  onOpenItem,
  onDragItems,
}: FileShelfContentProps) => (
  <div ref={contentRef} className="file-shelf__content" aria-live="polite">
    {loading ? (
      <div className="file-shelf__empty">棚を読み込んでいます…</div>
    ) : totalGroupCount === 0 ? (
      <div className="file-shelf__empty">
        <Archive size={32} aria-hidden="true" />
        <strong>棚は空です</strong>
        <span>
          Explorerから画面端へドラッグするか、下から選んで追加できます
        </span>
        <div className="file-shelf__empty-actions">
          <button type="button" onClick={() => void onChoosePaths()}>
            <Plus size={14} aria-hidden="true" />
            ファイル
          </button>
          <button type="button" onClick={() => void onChooseFolders()}>
            <FolderPlus size={14} aria-hidden="true" />
            フォルダ
          </button>
        </div>
      </div>
    ) : visibleGroups.length === 0 ? (
      <div className="file-shelf__empty file-shelf__empty--search">
        <Search size={28} aria-hidden="true" />
        <strong>一致する項目がありません</strong>
        <span>名前、パス、URL、文章から検索しています</span>
        <button type="button" onClick={onClearQuery}>
          検索をクリア
        </button>
      </div>
    ) : (
      visibleGroups.map((group) => {
        const isStack = group.items.length > 1;
        const isOpen = normalizedQuery ? true : expandedGroups.has(group.id);
        const draggableItems = group.items.filter(
          (item) => item.availability === "ready" && Boolean(item.sourcePath),
        );
        return (
          <article className="file-shelf__group" key={group.id}>
            <div className="file-shelf__group-summary">
              {isStack ? (
                <button
                  type="button"
                  className={`file-shelf__stack-toggle${draggableItems.length ? " is-draggable" : ""}${cursorKey === `group:${group.id}` ? " is-keyboard-active" : ""}`}
                  onClick={(event) => {
                    if (rowDrag.consumeSuppressedClick()) {
                      event.preventDefault();
                      return;
                    }
                    onToggleGroup(group.id);
                  }}
                  onPointerDown={(event) =>
                    rowDrag.begin(event, draggableItems)
                  }
                  onPointerMove={rowDrag.move}
                  onPointerUp={rowDrag.end}
                  onPointerCancel={rowDrag.end}
                  aria-expanded={isOpen}
                  title={
                    draggableItems.length
                      ? "行をドラッグして取り出す"
                      : undefined
                  }
                  data-shelf-cursor-key={
                    normalizedQuery ? undefined : `group:${group.id}`
                  }
                >
                  {isOpen ? (
                    <ChevronDown size={16} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={16} aria-hidden="true" />
                  )}
                  <span className="file-shelf__stack-icons">
                    {group.items.slice(0, 3).map((item) => (
                      <FileShelfItemIcon kind={item.kind} key={item.id} />
                    ))}
                  </span>
                  <span>
                    <strong>{group.items.length}件のスタック</strong>
                    <small>
                      {group.items.map((item) => item.displayName).join("、")}
                    </small>
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  className={`file-shelf__single${draggableItems.length ? " is-draggable" : ""}${selectedIds.has(group.items[0].id) ? " is-selected" : ""}${cursorKey === `item:${group.items[0].id}` ? " is-keyboard-active" : ""}`}
                  onClick={(event) => {
                    if (rowDrag.consumeSuppressedClick()) {
                      event.preventDefault();
                      return;
                    }
                    onSelectItem(
                      group.items[0],
                      event.ctrlKey || event.metaKey,
                    );
                  }}
                  onPointerDown={(event) =>
                    rowDrag.begin(event, draggableItems)
                  }
                  onPointerMove={rowDrag.move}
                  onPointerUp={rowDrag.end}
                  onPointerCancel={rowDrag.end}
                  onDoubleClick={() => void onOpenItem(group.items[0])}
                  title={
                    draggableItems.length
                      ? "クリックで選択、ドラッグで取り出す"
                      : undefined
                  }
                  aria-pressed={selectedIds.has(group.items[0].id)}
                  data-shelf-cursor-key={`item:${group.items[0].id}`}
                >
                  <FileShelfItemIcon kind={group.items[0].kind} />
                  <span>
                    <strong>{group.items[0].displayName}</strong>
                    <small>
                      {group.items[0].availability === "missing"
                        ? "元の場所に見つかりません"
                        : [
                            group.items[0].source === "clipboardHistory"
                              ? "履歴"
                              : null,
                            group.items[0].pinned ? "固定" : null,
                            kindLabel[group.items[0].kind],
                            formatBytes(group.items[0].sizeBytes),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                    </small>
                  </span>
                </button>
              )}
              <button
                type="button"
                className="file-shelf__drag-handle"
                disabled={!draggableItems.length || busy}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  void onDragItems(draggableItems, event.shiftKey);
                }}
                aria-label={`${isStack ? "スタック" : group.items[0].displayName}をドラッグして取り出す`}
                title={
                  draggableItems.length
                    ? "ドラッグして取り出す（Shiftで移動）"
                    : "文章とURLは選択してコピー"
                }
              >
                <GripVertical size={17} aria-hidden="true" />
              </button>
            </div>

            {isStack && isOpen && (
              <div className="file-shelf__items">
                {group.items.map((item) => (
                  <div
                    className={`file-shelf__item${selectedIds.has(item.id) ? " is-selected" : ""}`}
                    key={item.id}
                  >
                    <button
                      type="button"
                      className={`file-shelf__item-main${item.availability === "ready" && item.sourcePath ? " is-draggable" : ""}${cursorKey === `item:${item.id}` ? " is-keyboard-active" : ""}`}
                      onClick={(event) => {
                        if (rowDrag.consumeSuppressedClick()) {
                          event.preventDefault();
                          return;
                        }
                        onSelectItem(item, event.ctrlKey || event.metaKey);
                      }}
                      onPointerDown={(event) => rowDrag.begin(event, [item])}
                      onPointerMove={rowDrag.move}
                      onPointerUp={rowDrag.end}
                      onPointerCancel={rowDrag.end}
                      onDoubleClick={() => void onOpenItem(item)}
                      title={
                        item.availability === "ready" && item.sourcePath
                          ? "クリックで選択、ドラッグで取り出す"
                          : undefined
                      }
                      aria-pressed={selectedIds.has(item.id)}
                      data-shelf-cursor-key={`item:${item.id}`}
                    >
                      <FileShelfItemIcon kind={item.kind} />
                      <span>
                        <strong>{item.displayName}</strong>
                        <small>
                          {item.availability === "missing"
                            ? "見つかりません"
                            : [
                                item.source === "clipboardHistory"
                                  ? "履歴"
                                  : null,
                                item.pinned ? "固定" : null,
                                kindLabel[item.kind],
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                        </small>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="file-shelf__drag-handle"
                      disabled={
                        item.availability !== "ready" ||
                        !item.sourcePath ||
                        busy
                      }
                      onPointerDown={(event) => {
                        if (event.button !== 0) return;
                        event.preventDefault();
                        void onDragItems([item], event.shiftKey);
                      }}
                      aria-label={`${item.displayName}をドラッグして取り出す`}
                    >
                      <GripVertical size={16} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </article>
        );
      })
    )}
  </div>
);
