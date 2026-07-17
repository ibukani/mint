import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { revealElementVertically } from "../../../design/layout";
import type { FileShelfItem } from "../types";
import { isSupportedUrl, supportedImageTypes } from "../utils";
import type { FileShelfController } from "./useFileShelf";

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

interface UseFileShelfOverlayInteractionsProps {
  shelf: FileShelfController;
  allItems: FileShelfItem[];
  cursorKey: string;
  selectedIds: Set<string>;
  previewItemId: string;
  previewPinned: boolean;
}

export const useFileShelfOverlayInteractions = ({
  shelf,
  allItems,
  cursorKey,
  selectedIds,
  previewItemId,
  previewPinned,
}: UseFileShelfOverlayInteractionsProps) => {
  const [editingItemId, setEditingItemId] = useState("");
  const [editingName, setEditingName] = useState("");
  const collapseTimer = useRef<number | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const editingItem = useMemo(
    () => allItems.find((item) => item.id === editingItemId) ?? null,
    [allItems, editingItemId],
  );

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
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement ||
      (event.target instanceof HTMLElement && event.target.isContentEditable)
    ) {
      return;
    }
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
  const focusSearch = () => {
    searchRef.current?.focus({ preventScroll: true });
    searchRef.current?.select();
  };

  return {
    cancelRenaming,
    commitRename,
    containerRef,
    contentRef,
    editingItem,
    editingName,
    focusSearch,
    handlePaste,
    previewItemId,
    renameInputRef,
    scheduleCollapse,
    searchRef,
    setEditingName,
    startRenaming,
    stopCollapseTimer,
  };
};
