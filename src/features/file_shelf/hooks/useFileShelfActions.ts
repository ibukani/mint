import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback } from "react";
import {
  addFileShelfContent,
  addFileShelfPaths,
  chooseFileShelfFolders,
  chooseFileShelfPaths,
  clearFileShelf,
  clearFileShelfClipboardHistory,
  openFileShelfPath,
  openFileShelfUrl,
  removeFileShelfItems,
  renameFileShelfItem,
  restoreFileShelfRemoval,
  restoreRecentFileShelfRemoval,
  revealFileShelfPath,
  setFileShelfItemsPinned,
  startFileShelfDrag,
} from "../api";
import type {
  AddFileShelfContentInput,
  FileShelfItem,
  FileShelfMutation,
  FileShelfRemoval,
  FileShelfState,
} from "../types";

interface OperationResult<T> {
  current: boolean;
  value?: T;
}

interface FileShelfActionOptions {
  operationRevision: MutableRefObject<number>;
  applyState: (next: FileShelfState) => void;
  reportError: (reason: unknown) => void;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  setNotice: Dispatch<SetStateAction<string>>;
  setUndoToken: Dispatch<SetStateAction<string>>;
  undoToken: string;
  pendingDragItemIds: string[];
  setPendingDragItemIds: Dispatch<SetStateAction<string[]>>;
}

export const useFileShelfActions = ({
  operationRevision,
  applyState,
  reportError,
  setBusy,
  setError,
  setNotice,
  setUndoToken,
  undoToken,
  pendingDragItemIds,
  setPendingDragItemIds,
}: FileShelfActionOptions) => {
  const runMutation = useCallback(
    async <T>(
      operation: () => Promise<T>,
      onSuccess: (value: T) => void,
      options: { clearNotice?: boolean } = {},
    ): Promise<OperationResult<T>> => {
      const revision = ++operationRevision.current;
      setBusy(true);
      setError("");
      if (options.clearNotice ?? true) setNotice("");

      try {
        const value = await operation();
        const current = revision === operationRevision.current;
        if (current) onSuccess(value);
        return { current, value };
      } catch (reason) {
        if (revision === operationRevision.current) reportError(reason);
        return { current: false };
      } finally {
        if (revision === operationRevision.current) setBusy(false);
      }
    },
    [operationRevision, reportError, setBusy, setError, setNotice],
  );

  const runUserAction = useCallback(
    async (operation: () => Promise<void>) => {
      try {
        await operation();
      } catch (reason) {
        reportError(reason);
      }
    },
    [reportError],
  );

  const addPaths = useCallback(
    async (paths: string[]) => {
      if (!paths.length) return;
      await runMutation(
        () => addFileShelfPaths({ paths }),
        (mutation: FileShelfMutation) => {
          applyState(mutation.state);
          setNotice(
            mutation.addedCount > 0
              ? `${mutation.addedCount}件を預かりました${mutation.skippedCount ? `（${mutation.skippedCount}件は追加済みまたは無効）` : ""}`
              : "追加できる新しい項目がありませんでした",
          );
        },
      );
    },
    [applyState, runMutation, setNotice],
  );

  const addContent = useCallback(
    async (input: AddFileShelfContentInput) => {
      await runMutation(
        () => addFileShelfContent(input),
        (mutation: FileShelfMutation) => {
          applyState(mutation.state);
          setNotice("クリップボードから1件預かりました");
        },
      );
    },
    [applyState, runMutation, setNotice],
  );

  const choosePaths = useCallback(async () => {
    try {
      const selection = await chooseFileShelfPaths();
      if (!selection) return;
      await addPaths(Array.isArray(selection) ? selection : [selection]);
    } catch (reason) {
      reportError(reason);
    }
  }, [addPaths, reportError]);

  const chooseFolders = useCallback(async () => {
    try {
      const selection = await chooseFileShelfFolders();
      if (!selection) return;
      await addPaths(Array.isArray(selection) ? selection : [selection]);
    } catch (reason) {
      reportError(reason);
    }
  }, [addPaths, reportError]);

  const removeItems = useCallback(
    async (itemIds: string[]) => {
      await runMutation(
        () => removeFileShelfItems(itemIds),
        (removal: FileShelfRemoval) => {
          applyState(removal.state);
          setUndoToken(removal.undoToken);
          setNotice(`${itemIds.length}件を棚から外しました`);
        },
      );
    },
    [applyState, runMutation, setNotice, setUndoToken],
  );

  const clear = useCallback(async () => {
    await runMutation(
      clearFileShelf,
      (removal: FileShelfRemoval) => {
        applyState(removal.state);
        setUndoToken(removal.undoToken);
        setNotice("棚を空にしました");
      },
      { clearNotice: false },
    );
  }, [applyState, runMutation, setNotice, setUndoToken]);

  const clearClipboardHistory = useCallback(async () => {
    await runMutation(
      clearFileShelfClipboardHistory,
      (removal: FileShelfRemoval) => {
        applyState(removal.state);
        setUndoToken(removal.undoToken);
        setNotice("クリップボード履歴を消去しました");
      },
    );
  }, [applyState, runMutation, setNotice, setUndoToken]);

  const restore = useCallback(
    async (restoreOperation: () => Promise<FileShelfState>, notice: string) => {
      await runMutation(restoreOperation, (next: FileShelfState) => {
        applyState(next);
        setUndoToken("");
        setNotice(notice);
      });
    },
    [applyState, runMutation, setNotice, setUndoToken],
  );

  const restoreUndo = useCallback(async () => {
    if (!undoToken) return;
    await restore(() => restoreFileShelfRemoval(undoToken), "棚へ戻しました");
  }, [restore, undoToken]);

  const restoreRecent = useCallback(async () => {
    await restore(
      restoreRecentFileShelfRemoval,
      "最近外した項目を棚へ戻しました",
    );
  }, [restore]);

  const pinItems = useCallback(
    async (items: FileShelfItem[], pinned: boolean) => {
      if (!items.length) return;
      await runMutation(
        () =>
          setFileShelfItemsPinned(
            items.map((item) => item.id),
            pinned,
          ),
        (next: FileShelfState) => {
          applyState(next);
          setNotice(
            pinned
              ? `${items.length}件を棚に固定しました`
              : `${items.length}件の固定を解除しました`,
          );
        },
      );
    },
    [applyState, runMutation, setNotice],
  );

  const renameItem = useCallback(
    async (item: FileShelfItem, displayName: string) => {
      const result = await runMutation(
        () => renameFileShelfItem(item.id, displayName),
        (next: FileShelfState) => {
          applyState(next);
          setNotice(`「${displayName.trim()}」として棚に表示します`);
        },
      );
      return result.current && result.value !== undefined;
    },
    [applyState, runMutation, setNotice],
  );

  const dragItems = useCallback(
    async (items: FileShelfItem[], move = false) => {
      const ready = items.filter(
        (item) => item.availability === "ready" && item.sourcePath,
      );
      if (!ready.length) {
        reportError(
          new Error("文章とURLは、項目を選択してコピーしてください。"),
        );
        return;
      }

      await runMutation(
        () =>
          startFileShelfDrag(
            ready.map((item) => item.sourcePath as string),
            move ? "move" : "copy",
          ),
        (result) => {
          if (result !== "Dropped") return;
          const removable = ready.filter((item) => !item.pinned);
          if (removable.length) {
            setPendingDragItemIds((previous) =>
              Array.from(
                new Set([...previous, ...removable.map((item) => item.id)]),
              ),
            );
          }
          const retainedCount = ready.length - removable.length;
          setNotice(
            removable.length
              ? `${ready.length}件の取り出し操作を完了しました。ドロップ先を確認してください${retainedCount ? `（固定中の${retainedCount}件は棚に残ります）` : ""}`
              : `${ready.length}件を取り出しました（固定中の項目は棚に残ります）`,
          );
        },
        { clearNotice: false },
      );
    },
    [reportError, runMutation, setNotice, setPendingDragItemIds],
  );

  const confirmDraggedItems = useCallback(async () => {
    if (!pendingDragItemIds.length) return;
    await runMutation(
      () => removeFileShelfItems(pendingDragItemIds),
      (removal: FileShelfRemoval) => {
        applyState(removal.state);
        setUndoToken(removal.undoToken);
        setPendingDragItemIds([]);
        setNotice(`${pendingDragItemIds.length}件を棚から外しました`);
      },
    );
  }, [
    applyState,
    pendingDragItemIds,
    runMutation,
    setNotice,
    setPendingDragItemIds,
    setUndoToken,
  ]);

  const keepDraggedItems = useCallback(() => {
    if (!pendingDragItemIds.length) return;
    const count = pendingDragItemIds.length;
    setPendingDragItemIds([]);
    setNotice(`${count}件を棚に残しました`);
  }, [pendingDragItemIds, setNotice, setPendingDragItemIds]);

  const copyItem = useCallback(
    async (item: FileShelfItem) => {
      const value = item.textContent ?? item.sourcePath;
      if (!value) return;
      await runUserAction(async () => {
        await navigator.clipboard.writeText(value);
        setNotice("クリップボードへコピーしました");
      });
    },
    [runUserAction, setNotice],
  );

  const copyItems = useCallback(
    async (items: FileShelfItem[]) => {
      const values = items
        .map((item) => item.textContent ?? item.sourcePath)
        .filter((value): value is string => Boolean(value));
      if (!values.length) return;
      await runUserAction(async () => {
        await navigator.clipboard.writeText(values.join("\n"));
        setNotice(`${values.length}件をクリップボードへコピーしました`);
      });
    },
    [runUserAction, setNotice],
  );

  const openItem = useCallback(
    (item: FileShelfItem) =>
      runUserAction(async () => {
        if (item.kind === "url" && item.textContent) {
          await openFileShelfUrl(item.textContent);
        } else if (item.sourcePath) {
          await openFileShelfPath(item.sourcePath);
        }
      }),
    [runUserAction],
  );

  const revealItem = useCallback(
    (item: FileShelfItem) => {
      if (!item.sourcePath) return Promise.resolve();
      return runUserAction(() =>
        revealFileShelfPath(item.sourcePath as string),
      );
    },
    [runUserAction],
  );

  return {
    addPaths,
    addContent,
    choosePaths,
    chooseFolders,
    removeItems,
    clear,
    clearClipboardHistory,
    undo: restoreUndo,
    restoreRecent,
    pinItems,
    renameItem,
    dragItems,
    confirmDraggedItems,
    keepDraggedItems,
    copyItem,
    copyItems,
    openItem,
    revealItem,
  };
};
