import type React from "react";
import type { FileShelfItem } from "../types";
import type { FileShelfController } from "./useFileShelf";
import type { ShelfCursorEntry } from "./useFileShelfOverlayState";

const PAGE_MOVE_SIZE = 5;

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement && target.isContentEditable);

interface UseFileShelfOverlayKeyboardProps {
  shelf: FileShelfController;
  cursorEntries: ShelfCursorEntry[];
  cursorKey: string;
  moveCursor: (index: number) => void;
  toggleGroup: (groupId: string) => void;
  selectItem: (item: FileShelfItem, additive: boolean) => void;
  selectedIds: Set<string>;
  setSelectedIds: (value: Set<string>) => void;
  selectedItems: FileShelfItem[];
  removableSelectedItems: FileShelfItem[];
  visibleItems: FileShelfItem[];
  query: string;
  setQuery: (value: string) => void;
  previewItemId: string;
  closePreview: () => void;
  setPreviewPinned: React.Dispatch<React.SetStateAction<boolean>>;
  togglePreview: (item: FileShelfItem) => void;
  startRenaming: (item: FileShelfItem) => void;
  focusSearch: () => void;
  containerRef: React.RefObject<HTMLElement | null>;
}

export const useFileShelfOverlayKeyboard = ({
  shelf,
  cursorEntries,
  cursorKey,
  moveCursor,
  toggleGroup,
  selectItem,
  selectedIds,
  setSelectedIds,
  selectedItems,
  removableSelectedItems,
  visibleItems,
  query,
  setQuery,
  previewItemId,
  closePreview,
  setPreviewPinned,
  togglePreview,
  startRenaming,
  focusSearch,
  containerRef,
}: UseFileShelfOverlayKeyboardProps) => {
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
    const cursorItem = () =>
      cursorEntries.find(
        (entry): entry is Extract<ShelfCursorEntry, { kind: "item" }> =>
          entry.key === cursorKey && entry.kind === "item",
      )?.item;
    const selectedOrCursorItem = () =>
      selectedItems.length === 1 ? selectedItems[0] : cursorItem();

    if (modifierPressed && key === "f") {
      event.preventDefault();
      focusSearch();
    } else if (event.key === "F2" && !modifierPressed && !event.altKey) {
      const target = selectedOrCursorItem();
      if (target) {
        event.preventDefault();
        startRenaming(target);
      }
    } else if (!modifierPressed && !event.altKey && key === "q") {
      const target = selectedOrCursorItem();
      if (target) {
        event.preventDefault();
        togglePreview(target);
      }
    } else if (
      previewItemId &&
      !modifierPressed &&
      !event.altKey &&
      key === "p"
    ) {
      event.preventDefault();
      setPreviewPinned((current) => !current);
    } else if (
      event.key === "/" &&
      !modifierPressed &&
      !event.altKey &&
      !isEditableTarget(event.target)
    ) {
      event.preventDefault();
      focusSearch();
    } else if (event.key === "Escape") {
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
      if (selectedItems.length === 1) void shelf.copyItem(selectedItems[0]);
      else void shelf.copyItems(selectedItems);
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
      moveCursor(
        event.key === "PageDown"
          ? Math.min(cursorEntries.length - 1, safeIndex + PAGE_MOVE_SIZE)
          : Math.max(0, safeIndex - PAGE_MOVE_SIZE),
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const entry = cursorEntries.find(
        (candidate) => candidate.key === cursorKey,
      );
      if (!entry) return;
      if (entry.kind === "group") toggleGroup(entry.groupId);
      else {
        setSelectedIds(new Set([entry.item.id]));
        void shelf.openItem(entry.item);
      }
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

  return { handleKeyDown };
};
