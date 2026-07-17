import { useAppSettings } from "../../../core/context/AppSettings";
import { defaultAppSettings } from "../../../core/defaultSettings";
import { useOverlayWindowEviction } from "../../../core/hooks/useOverlayWindowEviction";
import { useOverlayWindowReady } from "../../../core/hooks/useOverlayWindowReady";
import {
  getPlatformShortcutModifier,
  isApplePlatform,
} from "../../../design/layout";
import { useFileShelf } from "./useFileShelf";
import { useFileShelfDragGesture } from "./useFileShelfDragGesture";
import { useFileShelfOverlayInteractions } from "./useFileShelfOverlayInteractions";
import { useFileShelfOverlayKeyboard } from "./useFileShelfOverlayKeyboard";
import { useFileShelfOverlayState } from "./useFileShelfOverlayState";
import { useFileShelfPreview } from "./useFileShelfPreview";

export const useFileShelfOverlayController = () => {
  const { settings } = useAppSettings();
  const shelf = useFileShelf();
  useOverlayWindowEviction(shelf.expanded, {
    enabled: settings?.fileShelf.edgeHandleEnabled === false,
  });
  useOverlayWindowReady();
  const rowDrag = useFileShelfDragGesture({
    disabled: shelf.busy,
    onDrag: shelf.dragItems,
  });
  const overlayState = useFileShelfOverlayState({ groups: shelf.state.groups });
  const preview = useFileShelfPreview({ allItems: overlayState.allItems });
  const interactions = useFileShelfOverlayInteractions({
    shelf,
    allItems: overlayState.allItems,
    cursorKey: overlayState.cursorKey,
    selectedIds: overlayState.selectedIds,
    previewItemId: preview.previewItemId,
    previewPinned: preview.previewPinned,
  });
  const keyboard = useFileShelfOverlayKeyboard({
    shelf,
    cursorEntries: overlayState.cursorEntries,
    cursorKey: overlayState.cursorKey,
    moveCursor: overlayState.moveCursor,
    toggleGroup: overlayState.toggleGroup,
    selectItem: overlayState.selectItem,
    selectedIds: overlayState.selectedIds,
    setSelectedIds: overlayState.setSelectedIds,
    selectedItems: overlayState.selectedItems,
    removableSelectedItems: overlayState.removableSelectedItems,
    visibleItems: overlayState.visibleItems,
    query: overlayState.query,
    setQuery: overlayState.setQuery,
    previewItemId: preview.previewItemId,
    closePreview: preview.closePreview,
    setPreviewPinned: preview.setPreviewPinned,
    togglePreview: preview.togglePreview,
    startRenaming: interactions.startRenaming,
    focusSearch: interactions.focusSearch,
    containerRef: interactions.containerRef,
  });

  return {
    ...overlayState,
    ...preview,
    ...interactions,
    ...keyboard,
    rowDrag,
    shelf,
    shortcutModifier: getPlatformShortcutModifier(),
    shortcutAriaModifier: isApplePlatform() ? "Meta" : "Control",
    themeColor:
      settings?.fileShelf.themeColor || defaultAppSettings.fileShelf.themeColor,
  };
};
