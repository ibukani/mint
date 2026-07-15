import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppSettings } from "../../../core/context/AppSettings";
import { defaultAppSettings } from "../../../core/defaultSettings";
import {
  getPlatformShortcutModifier,
  isApplePlatform,
  revealElementVertically,
} from "../../../design/layout";
import { loadFileShelfPreview } from "../api";
import { useFileShelf } from "../hooks/useFileShelf";
import { useFileShelfDragGesture } from "../hooks/useFileShelfDragGesture";
import type { FileShelfItem } from "../types";
import { isSupportedUrl, matchesQuery, supportedImageTypes } from "../utils";

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

const PAGE_MOVE_SIZE = 5;

type ShelfCursorEntry =
  | { key: string; kind: "group"; groupId: string }
  | { key: string; kind: "item"; item: FileShelfItem };

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement && target.isContentEditable);

export const useFileShelfOverlayController = () => {
  const { settings } = useAppSettings();
  const shelf = useFileShelf();
  const rowDrag = useFileShelfDragGesture({
    disabled: shelf.busy,
    onDrag: shelf.dragItems,
  });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [cursorKey, setCursorKey] = useState("");
  const [previewItemId, setPreviewItemId] = useState("");
  const [previewPinned, setPreviewPinned] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [editingItemId, setEditingItemId] = useState("");
  const [editingName, setEditingName] = useState("");
  const collapseTimer = useRef<number | null>(null);
  const knownGroupIds = useRef<Set<string> | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const previewCloseRef = useRef<HTMLButtonElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const previewRevision = useRef(0);
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

  const previewItem = useMemo(
    () => allItems.find((item) => item.id === previewItemId) ?? null,
    [allItems, previewItemId],
  );

  const editingItem = useMemo(
    () => allItems.find((item) => item.id === editingItemId) ?? null,
    [allItems, editingItemId],
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
    if (editingItemId && !editingItem) {
      setEditingItemId("");
      setEditingName("");
    }
  }, [editingItem, editingItemId]);

  useEffect(() => {
    if (!editingItem) return;
    renameInputRef.current?.focus({ preventScroll: true });
    renameInputRef.current?.select();
  }, [editingItem]);

  useEffect(() => {
    const nextIds = new Set(shelf.state.groups.map((group) => group.id));
    if (knownGroupIds.current) {
      const addedStackIds = shelf.state.groups
        .filter(
          (group) =>
            group.items.length > 1 && !knownGroupIds.current?.has(group.id),
        )
        .map((group) => group.id);
      if (addedStackIds.length) {
        setExpandedGroups(
          (previous) => new Set([...previous, ...addedStackIds]),
        );
      }
    }
    knownGroupIds.current = nextIds;
  }, [shelf.state.groups]);

  useEffect(() => {
    if (previewItemId && !previewItem) {
      setPreviewItemId("");
      setPreviewPinned(false);
    }
  }, [previewItem, previewItemId]);

  useEffect(() => {
    const revision = ++previewRevision.current;
    setPreviewDataUrl(null);
    setPreviewError("");
    if (previewItem?.kind !== "image" || previewItem.availability !== "ready") {
      setPreviewLoading(false);
      return;
    }
    setPreviewLoading(true);
    void loadFileShelfPreview(previewItem.id)
      .then((preview) => {
        if (revision === previewRevision.current) {
          setPreviewDataUrl(preview.dataUrl);
        }
      })
      .catch((reason: unknown) => {
        if (revision === previewRevision.current) {
          setPreviewError(
            reason instanceof Error ? reason.message : String(reason),
          );
        }
      })
      .finally(() => {
        if (revision === previewRevision.current) setPreviewLoading(false);
      });
  }, [previewItem]);

  useEffect(() => {
    if (!previewItem) return;
    previewCloseRef.current?.focus({ preventScroll: true });
  }, [previewItem]);

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
    if (shelf.busy || !shelf.transientExpanded || previewPinned) return;
    collapseTimer.current = window.setTimeout(() => {
      void shelf.changeExpanded(false);
    }, 1_200);
  };

  const handlePaste = async (event: React.ClipboardEvent) => {
    if (isEditableTarget(event.target)) return;
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
      isSupportedUrl(text)
        ? { kind: "url", url: text }
        : { kind: "text", text },
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
  const removableSelectedItems = selectedItems.filter((item) => !item.pinned);

  const closePreview = () => {
    setPreviewItemId("");
    setPreviewPinned(false);
  };

  const togglePreview = (item: FileShelfItem) => {
    if (previewItemId === item.id) {
      closePreview();
      return;
    }
    setPreviewItemId(item.id);
    setPreviewPinned(false);
  };

  const startRenaming = (item: FileShelfItem) => {
    setEditingItemId(item.id);
    setEditingName(item.displayName);
  };

  const cancelRenaming = () => {
    setEditingItemId("");
    setEditingName("");
    containerRef.current?.focus({ preventScroll: true });
  };

  const commitRename = async () => {
    if (!editingItem) return;
    const renamed = await shelf.renameItem(editingItem, editingName);
    if (renamed) cancelRenaming();
  };

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

    if (
      isEditableTarget(event.target) &&
      event.key !== "Escape" &&
      event.key !== "Enter" &&
      !["ArrowDown", "ArrowUp", "Home", "End", "PageUp", "PageDown"].includes(
        event.key,
      ) &&
      !(modifierPressed && key === "f")
    ) {
      return;
    }

    if (modifierPressed && key === "f") {
      event.preventDefault();
      focusSearch();
      return;
    }
    if (event.key === "F2" && !modifierPressed && !event.altKey) {
      const cursorItem = cursorEntries.find(
        (entry): entry is Extract<ShelfCursorEntry, { kind: "item" }> =>
          entry.key === cursorKey && entry.kind === "item",
      )?.item;
      const target = selectedItems.length === 1 ? selectedItems[0] : cursorItem;
      if (target) {
        event.preventDefault();
        startRenaming(target);
      }
      return;
    }
    if (!modifierPressed && !event.altKey && key === "q") {
      const cursorItem = cursorEntries.find(
        (entry): entry is Extract<ShelfCursorEntry, { kind: "item" }> =>
          entry.key === cursorKey && entry.kind === "item",
      )?.item;
      const target = selectedItems.length === 1 ? selectedItems[0] : cursorItem;
      if (target) {
        event.preventDefault();
        togglePreview(target);
      }
      return;
    }
    if (previewItemId && !modifierPressed && !event.altKey && key === "p") {
      event.preventDefault();
      setPreviewPinned((current) => !current);
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
      if (previewItemId) {
        closePreview();
        containerRef.current?.focus({ preventScroll: true });
      } else if (query) {
        setQuery("");
        focusSearch();
      } else if (selectedIds.size > 0) {
        setSelectedIds(new Set());
        containerRef.current?.focus({ preventScroll: true });
      } else {
        void shelf.changeExpanded(false);
      }
    } else if (modifierPressed && key === "z" && shelf.undoToken) {
      event.preventDefault();
      void shelf.undo();
    } else if (event.key === "Delete" && selectedIds.size > 0) {
      event.preventDefault();
      if (removableSelectedItems.length) {
        void shelf.removeItems(removableSelectedItems.map((item) => item.id));
      } else {
        shelf.reportError(
          new Error("固定中の項目は、固定を解除してから棚から外してください。"),
        );
      }
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
    } else if (event.key === "PageDown" || event.key === "PageUp") {
      event.preventDefault();
      const currentIndex = cursorEntries.findIndex(
        (entry) => entry.key === cursorKey,
      );
      const safeIndex = Math.max(0, currentIndex);
      const nextIndex =
        event.key === "PageDown"
          ? Math.min(cursorEntries.length - 1, safeIndex + PAGE_MOVE_SIZE)
          : Math.max(0, safeIndex - PAGE_MOVE_SIZE);
      moveCursor(nextIndex);
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

  const themeColor =
    settings?.fileShelf.themeColor || defaultAppSettings.fileShelf.themeColor;

  return {
    shelf,
    rowDrag,
    themeColor,
    expandedGroups,
    selectedIds,
    query,
    setQuery,
    normalizedQuery,
    visibleGroups,
    visibleItems,
    previewItem,
    previewPinned,
    setPreviewPinned,
    previewDataUrl,
    previewLoading,
    previewError,
    editingItem,
    editingName,
    setEditingName,
    cursorKey,
    containerRef,
    contentRef,
    searchRef,
    previewCloseRef,
    renameInputRef,
    shortcutModifier,
    shortcutAriaModifier,
    selectedItems,
    removableSelectedItems,
    stopCollapseTimer,
    scheduleCollapse,
    handlePaste,
    selectItem,
    closePreview,
    togglePreview,
    startRenaming,
    cancelRenaming,
    commitRename,
    toggleGroup,
    focusSearch,
    handleKeyDown,
  };
};
