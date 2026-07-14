import {
  Archive,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Copy,
  ExternalLink,
  File,
  FileImage,
  Folder,
  FolderSearch,
  GripVertical,
  History,
  Link,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { OverlayFrame } from "../../../design/layout";
import { useFileShelf } from "../hooks/useFileShelf";
import type { FileShelfItem, FileShelfItemKind } from "../types";
import "./FileShelfOverlay.css";

const kindLabel: Record<FileShelfItemKind, string> = {
  file: "ファイル",
  folder: "フォルダ",
  image: "画像",
  text: "文章",
  url: "URL",
};

const ItemIcon = ({ kind }: { kind: FileShelfItemKind }) => {
  if (kind === "folder") return <Folder size={18} aria-hidden="true" />;
  if (kind === "image") return <FileImage size={18} aria-hidden="true" />;
  if (kind === "url") return <Link size={18} aria-hidden="true" />;
  if (kind === "text") return <Clipboard size={18} aria-hidden="true" />;
  return <File size={18} aria-hidden="true" />;
};

const formatBytes = (value: number | null) => {
  if (value === null) return null;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const imageAsBase64 = (file: globalThis.File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("画像を読み取れませんでした。"));
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      const separator = value.indexOf(",");
      if (separator < 0) reject(new Error("画像を読み取れませんでした。"));
      else resolve(value.slice(separator + 1));
    };
    reader.readAsDataURL(file);
  });

const isHttpUrl = (value: string) => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const supportedImageTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export const FileShelfOverlay: React.FC = () => {
  const shelf = useFileShelf();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const collapseTimer = useRef<number | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const activeIds = new Set(
      shelf.state.groups.flatMap((group) => group.items.map((item) => item.id)),
    );
    setSelectedIds(
      (previous) => new Set([...previous].filter((id) => activeIds.has(id))),
    );
  }, [shelf.state.groups]);

  useEffect(() => {
    if (shelf.expanded) containerRef.current?.focus();
  }, [shelf.expanded]);

  const stopCollapseTimer = () => {
    if (collapseTimer.current !== null) {
      window.clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
  };

  const scheduleCollapse = () => {
    stopCollapseTimer();
    if (shelf.busy) return;
    collapseTimer.current = window.setTimeout(() => {
      void shelf.changeExpanded(false);
    }, 700);
  };

  const handlePaste = async (event: React.ClipboardEvent) => {
    const image = Array.from(event.clipboardData.items)
      .find((item) => item.type.startsWith("image/"))
      ?.getAsFile();
    if (image) {
      event.preventDefault();
      try {
        if (!supportedImageTypes.has(image.type)) {
          throw new Error("PNG、JPEG、GIF、WebP画像を貼り付けてください。");
        }
        if (image.size > 25 * 1024 * 1024) {
          throw new Error("貼り付ける画像は25MB以下にしてください。");
        }
        await shelf.addContent({
          kind: "image",
          fileName: image.name || "pasted-image.png",
          mimeType: image.type || "image/png",
          dataBase64: await imageAsBase64(image),
        });
      } catch (reason) {
        shelf.reportError(reason);
      }
      return;
    }
    const text = event.clipboardData.getData("text/plain").trim();
    if (!text) return;
    event.preventDefault();
    await shelf.addContent(
      isHttpUrl(text) ? { kind: "url", url: text } : { kind: "text", text },
    );
  };

  const selectItem = (item: FileShelfItem, additive: boolean) => {
    const next = new Set(additive ? selectedIds : []);
    if (additive && next.has(item.id)) next.delete(item.id);
    else next.add(item.id);
    setSelectedIds(next);
  };

  const selectedItems = shelf.state.groups
    .flatMap((group) => group.items)
    .filter((item) => selectedIds.has(item.id));

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      void shelf.changeExpanded(false);
    } else if (event.key === "Delete" && selectedIds.size > 0) {
      event.preventDefault();
      void shelf.removeItems([...selectedIds]);
    } else if ((event.ctrlKey || event.metaKey) && event.key === "a") {
      event.preventDefault();
      setSelectedIds(
        new Set(
          shelf.state.groups.flatMap((group) =>
            group.items.map((item) => item.id),
          ),
        ),
      );
    } else if (
      (event.ctrlKey || event.metaKey) &&
      event.key === "c" &&
      selectedItems.length === 1
    ) {
      event.preventDefault();
      void shelf.copyItem(selectedItems[0]);
    }
  };

  if (!shelf.expanded) {
    return (
      <OverlayFrame>
        <button
          type="button"
          className="file-shelf-handle"
          onClick={() => void shelf.changeExpanded(true)}
          aria-label={`ファイルシェルを開く、${shelf.itemCount}件`}
        >
          <Archive size={17} aria-hidden="true" />
          <strong>{shelf.itemCount}</strong>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </OverlayFrame>
    );
  }

  return (
    <OverlayFrame>
      <section
        ref={containerRef}
        className="file-shelf"
        aria-label="ファイルシェル"
        tabIndex={-1}
        onPaste={(event) => void handlePaste(event)}
        onKeyDown={handleKeyDown}
        onMouseEnter={stopCollapseTimer}
        onMouseLeave={scheduleCollapse}
      >
        <header className="file-shelf__header">
          <div className="file-shelf__title">
            <Archive size={19} aria-hidden="true" />
            <div>
              <h1>ファイルシェル</h1>
              <span>{shelf.itemCount}件を預かっています</span>
            </div>
          </div>
          <div className="file-shelf__header-actions">
            {shelf.clipboardHistoryCount > 0 && (
              <button
                type="button"
                onClick={() => void shelf.clearClipboardHistory()}
                aria-label="クリップボード履歴だけを消去"
                title="クリップボード履歴だけを消去"
                disabled={shelf.busy}
              >
                <History size={17} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={() => void shelf.choosePaths()}
              aria-label="ファイルを追加"
              title="ファイルを追加"
              disabled={shelf.busy}
            >
              <Plus size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => void shelf.changeExpanded(false)}
              aria-label="シェルフを折りたたむ"
              title="折りたたむ"
            >
              <X size={17} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="file-shelf__paste-zone">
          <Clipboard size={16} aria-hidden="true" />
          <span>ここへドロップ、または Ctrl+V で画像・URL・文章を追加</span>
        </div>

        <div className="file-shelf__content" aria-live="polite">
          {shelf.loading ? (
            <div className="file-shelf__empty">棚を読み込んでいます…</div>
          ) : shelf.state.groups.length === 0 ? (
            <div className="file-shelf__empty">
              <Archive size={32} aria-hidden="true" />
              <strong>棚は空です</strong>
              <span>Explorerからファイルを画面端へドラッグしてください</span>
            </div>
          ) : (
            shelf.state.groups.map((group) => {
              const isStack = group.items.length > 1;
              const isOpen = expandedGroups.has(group.id);
              const draggableItems = group.items.filter(
                (item) =>
                  item.availability === "ready" && Boolean(item.sourcePath),
              );
              return (
                <article className="file-shelf__group" key={group.id}>
                  <div className="file-shelf__group-summary">
                    {isStack ? (
                      <button
                        type="button"
                        className="file-shelf__stack-toggle"
                        onClick={() => {
                          const next = new Set(expandedGroups);
                          if (isOpen) next.delete(group.id);
                          else next.add(group.id);
                          setExpandedGroups(next);
                        }}
                        aria-expanded={isOpen}
                      >
                        {isOpen ? (
                          <ChevronDown size={16} aria-hidden="true" />
                        ) : (
                          <ChevronRight size={16} aria-hidden="true" />
                        )}
                        <span className="file-shelf__stack-icons">
                          {group.items.slice(0, 3).map((item) => (
                            <ItemIcon kind={item.kind} key={item.id} />
                          ))}
                        </span>
                        <span>
                          <strong>{group.items.length}件のスタック</strong>
                          <small>
                            {group.items
                              .map((item) => item.displayName)
                              .join("、")}
                          </small>
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`file-shelf__single${selectedIds.has(group.items[0].id) ? " is-selected" : ""}`}
                        onClick={(event) =>
                          selectItem(
                            group.items[0],
                            event.ctrlKey || event.metaKey,
                          )
                        }
                        onDoubleClick={() =>
                          void shelf.openItem(group.items[0])
                        }
                        aria-pressed={selectedIds.has(group.items[0].id)}
                      >
                        <ItemIcon kind={group.items[0].kind} />
                        <span>
                          <strong>{group.items[0].displayName}</strong>
                          <small>
                            {group.items[0].availability === "missing"
                              ? "元の場所に見つかりません"
                              : [
                                  group.items[0].source === "clipboardHistory"
                                    ? "履歴"
                                    : null,
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
                      disabled={!draggableItems.length || shelf.busy}
                      onPointerDown={(event) => {
                        if (event.button !== 0) return;
                        event.preventDefault();
                        void shelf.dragItems(draggableItems, event.shiftKey);
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
                            className="file-shelf__item-main"
                            onClick={(event) =>
                              selectItem(item, event.ctrlKey || event.metaKey)
                            }
                            onDoubleClick={() => void shelf.openItem(item)}
                            aria-pressed={selectedIds.has(item.id)}
                          >
                            <ItemIcon kind={item.kind} />
                            <span>
                              <strong>{item.displayName}</strong>
                              <small>
                                {item.availability === "missing"
                                  ? "見つかりません"
                                  : [
                                      item.source === "clipboardHistory"
                                        ? "履歴"
                                        : null,
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
                              shelf.busy
                            }
                            onPointerDown={(event) => {
                              if (event.button !== 0) return;
                              event.preventDefault();
                              void shelf.dragItems([item], event.shiftKey);
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

        {selectedItems.length > 0 && (
          <div className="file-shelf__selection-actions">
            <span>{selectedItems.length}件を選択</span>
            {selectedItems.length === 1 && (
              <>
                <button
                  type="button"
                  onClick={() => void shelf.copyItem(selectedItems[0])}
                  aria-label="選択項目をコピー"
                >
                  <Copy size={15} aria-hidden="true" />
                </button>
                {(selectedItems[0].sourcePath ||
                  selectedItems[0].kind === "url") && (
                  <button
                    type="button"
                    onClick={() => void shelf.openItem(selectedItems[0])}
                    aria-label="選択項目を開く"
                  >
                    <ExternalLink size={15} aria-hidden="true" />
                  </button>
                )}
                {selectedItems[0].sourcePath && (
                  <button
                    type="button"
                    onClick={() => void shelf.revealItem(selectedItems[0])}
                    aria-label="Explorerで表示"
                  >
                    <FolderSearch size={15} aria-hidden="true" />
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              className="is-danger"
              onClick={() => void shelf.removeItems([...selectedIds])}
              aria-label="選択項目を棚から外す"
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
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
                {shelf.notice || "Shiftを押しながら取り出すと移動します"}
              </span>
            )}
          </div>
          {shelf.undoToken ? (
            <button type="button" onClick={() => void shelf.undo()}>
              <RotateCcw size={14} aria-hidden="true" />
              元に戻す
            </button>
          ) : (
            shelf.itemCount > 0 && (
              <button
                type="button"
                onClick={() => void shelf.clear()}
                disabled={shelf.busy}
              >
                <Trash2 size={14} aria-hidden="true" />
                すべて外す
              </button>
            )
          )}
        </footer>
      </section>
    </OverlayFrame>
  );
};
