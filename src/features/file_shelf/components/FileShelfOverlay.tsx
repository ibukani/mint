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
  Search,
  Trash2,
  X,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getPlatformShortcutModifier,
  isApplePlatform,
  OverlayFrame,
  revealElementVertically,
} from "../../../design/layout";
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

type ShelfCursorEntry =
  | { key: string; kind: "group"; groupId: string }
  | { key: string; kind: "item"; item: FileShelfItem };

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement && target.isContentEditable);

const matchesQuery = (item: FileShelfItem, query: string) =>
  [
    item.displayName,
    item.sourcePath,
    item.textContent,
    kindLabel[item.kind],
    item.source === "clipboardHistory" ? "履歴" : "手動",
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("ja")
    .includes(query);

export const FileShelfOverlay: React.FC = () => {
  const shelf = useFileShelf();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [cursorKey, setCursorKey] = useState("");
  const collapseTimer = useRef<number | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const shortcutModifier = getPlatformShortcutModifier();
  const shortcutAriaModifier = isApplePlatform() ? "Meta" : "Control";
  const normalizedQuery = query.trim().toLocaleLowerCase("ja");

  const allItems = useMemo(
    () => shelf.state.groups.flatMap((group) => group.items),
    [shelf.state.groups],
  );

  const visibleGroups = useMemo(
    () =>
      normalizedQuery
        ? shelf.state.groups.flatMap((group) => {
            const items = group.items.filter((item) =>
              matchesQuery(item, normalizedQuery),
            );
            return items.length ? [{ ...group, items }] : [];
          })
        : shelf.state.groups,
    [normalizedQuery, shelf.state.groups],
  );

  const visibleItems = useMemo(
    () => visibleGroups.flatMap((group) => group.items),
    [visibleGroups],
  );

  const cursorEntries = useMemo(
    () =>
      visibleGroups.flatMap<ShelfCursorEntry>((group) => {
        if (group.items.length === 1) {
          const item = group.items[0];
          return [{ key: `item:${item.id}`, kind: "item", item }];
        }
        const itemEntries = group.items.map<ShelfCursorEntry>((item) => ({
          key: `item:${item.id}`,
          kind: "item",
          item,
        }));
        if (normalizedQuery) return itemEntries;
        const groupEntry: ShelfCursorEntry = {
          key: `group:${group.id}`,
          kind: "group",
          groupId: group.id,
        };
        return expandedGroups.has(group.id)
          ? [groupEntry, ...itemEntries]
          : [groupEntry];
      }),
    [expandedGroups, normalizedQuery, visibleGroups],
  );

  useEffect(() => {
    const activeIds = new Set(allItems.map((item) => item.id));
    setSelectedIds(
      (previous) => new Set([...previous].filter((id) => activeIds.has(id))),
    );
  }, [allItems]);

  useEffect(() => {
    setCursorKey((previous) =>
      cursorEntries.some((entry) => entry.key === previous)
        ? previous
        : (cursorEntries[0]?.key ?? ""),
    );
  }, [cursorEntries]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content || !cursorKey) return;
    const active = Array.from(
      content.querySelectorAll<HTMLElement>("[data-shelf-cursor-key]"),
    ).find((element) => element.dataset.shelfCursorKey === cursorKey);
    if (!active) return;
    revealElementVertically(content, active, 8);
    if (selectedIds.size === 0) return;
    const frame = window.requestAnimationFrame(() => {
      revealElementVertically(content, active, 8);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [cursorKey, selectedIds]);

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
    setCursorKey(`item:${item.id}`);
  };

  const selectedItems = allItems.filter((item) => selectedIds.has(item.id));

  const toggleGroup = (groupId: string) => {
    const next = new Set(expandedGroups);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    setExpandedGroups(next);
  };

  const focusSearch = () => {
    searchRef.current?.focus({ preventScroll: true });
    searchRef.current?.select();
  };

  const moveCursor = (nextIndex: number) => {
    const entry = cursorEntries[nextIndex];
    if (!entry) return;
    setCursorKey(entry.key);
    if (entry.kind === "item") setSelectedIds(new Set([entry.item.id]));
    else setSelectedIds(new Set());
  };

  const activateCursor = () => {
    const entry = cursorEntries.find(
      (candidate) => candidate.key === cursorKey,
    );
    if (!entry) return;
    if (entry.kind === "group") {
      toggleGroup(entry.groupId);
      return;
    }
    setSelectedIds(new Set([entry.item.id]));
    void shelf.openItem(entry.item);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const modifierPressed = event.ctrlKey || event.metaKey;
    const key = event.key.toLocaleLowerCase();

    if (modifierPressed && key === "f") {
      event.preventDefault();
      focusSearch();
      return;
    }
    if (
      event.key === "/" &&
      !modifierPressed &&
      !event.altKey &&
      !isEditableTarget(event.target)
    ) {
      event.preventDefault();
      focusSearch();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (query) {
        setQuery("");
        focusSearch();
      } else if (selectedIds.size > 0) {
        setSelectedIds(new Set());
        containerRef.current?.focus({ preventScroll: true });
      } else {
        void shelf.changeExpanded(false);
      }
    } else if (event.key === "Delete" && selectedIds.size > 0) {
      event.preventDefault();
      void shelf.removeItems([...selectedIds]);
    } else if (modifierPressed && key === "a") {
      event.preventDefault();
      setSelectedIds(new Set(visibleItems.map((item) => item.id)));
    } else if (modifierPressed && key === "c" && selectedItems.length > 0) {
      event.preventDefault();
      if (selectedItems.length === 1) {
        void shelf.copyItem(selectedItems[0]);
      } else {
        void shelf.copyItems(selectedItems);
      }
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const currentIndex = cursorEntries.findIndex(
        (entry) => entry.key === cursorKey,
      );
      if (event.key === "Home") moveCursor(0);
      else if (event.key === "End") moveCursor(cursorEntries.length - 1);
      else if (event.key === "ArrowDown") {
        moveCursor(
          currentIndex < 0 ? 0 : (currentIndex + 1) % cursorEntries.length,
        );
      } else {
        moveCursor(
          currentIndex <= 0 ? cursorEntries.length - 1 : currentIndex - 1,
        );
      }
    } else if (event.key === "Enter") {
      event.preventDefault();
      activateCursor();
    } else if (event.key === " " && cursorKey) {
      const entry = cursorEntries.find(
        (candidate) => candidate.key === cursorKey,
      );
      if (!entry) return;
      event.preventDefault();
      if (entry.kind === "group") toggleGroup(entry.groupId);
      else selectItem(entry.item, true);
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

        <label className="file-shelf__search">
          <Search size={15} aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="棚を検索"
            aria-label="棚を検索"
            aria-keyshortcuts={`${shortcutAriaModifier}+F`}
          />
          {query ? (
            <>
              <span className="file-shelf__search-count" aria-live="polite">
                {visibleItems.length}件
              </span>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  focusSearch();
                }}
                aria-label="検索をクリア"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </>
          ) : (
            <kbd>{shortcutModifier} F</kbd>
          )}
        </label>

        <div
          ref={contentRef}
          className="file-shelf__content"
          aria-live="polite"
        >
          {shelf.loading ? (
            <div className="file-shelf__empty">棚を読み込んでいます…</div>
          ) : shelf.state.groups.length === 0 ? (
            <div className="file-shelf__empty">
              <Archive size={32} aria-hidden="true" />
              <strong>棚は空です</strong>
              <span>Explorerからファイルを画面端へドラッグしてください</span>
            </div>
          ) : visibleGroups.length === 0 ? (
            <div className="file-shelf__empty file-shelf__empty--search">
              <Search size={28} aria-hidden="true" />
              <strong>一致する項目がありません</strong>
              <span>名前、パス、URL、文章から検索しています</span>
              <button type="button" onClick={() => setQuery("")}>
                検索をクリア
              </button>
            </div>
          ) : (
            visibleGroups.map((group) => {
              const isStack = group.items.length > 1;
              const isOpen = normalizedQuery
                ? true
                : expandedGroups.has(group.id);
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
                        className={`file-shelf__stack-toggle${cursorKey === `group:${group.id}` ? " is-keyboard-active" : ""}`}
                        onClick={() => toggleGroup(group.id)}
                        aria-expanded={isOpen}
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
                        className={`file-shelf__single${selectedIds.has(group.items[0].id) ? " is-selected" : ""}${cursorKey === `item:${group.items[0].id}` ? " is-keyboard-active" : ""}`}
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
                        data-shelf-cursor-key={`item:${group.items[0].id}`}
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
                            className={`file-shelf__item-main${cursorKey === `item:${item.id}` ? " is-keyboard-active" : ""}`}
                            onClick={(event) =>
                              selectItem(item, event.ctrlKey || event.metaKey)
                            }
                            onDoubleClick={() => void shelf.openItem(item)}
                            aria-pressed={selectedIds.has(item.id)}
                            data-shelf-cursor-key={`item:${item.id}`}
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
            {selectedItems.length > 1 && (
              <button
                type="button"
                onClick={() => void shelf.copyItems(selectedItems)}
                aria-label="選択項目をコピー"
              >
                <Copy size={15} aria-hidden="true" />
              </button>
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
