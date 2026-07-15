import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addFileShelfContent,
  addFileShelfPaths,
  chooseFileShelfFolders,
  chooseFileShelfPaths,
  clearFileShelf,
  clearFileShelfClipboardHistory,
  loadFileShelfState,
  openFileShelfPath,
  openFileShelfUrl,
  removeFileShelfItems,
  renameFileShelfItem,
  restoreFileShelfRemoval,
  restoreRecentFileShelfRemoval,
  revealFileShelfPath,
  setFileShelfExpanded,
  setFileShelfItemsPinned,
  shouldAutoExpandFileShelf,
  startFileShelfDrag,
} from "../api";
import type {
  AddFileShelfContentInput,
  FileShelfItem,
  FileShelfState,
} from "../types";

const emptyState: FileShelfState = { groups: [] };

export const useFileShelf = () => {
  const [state, setState] = useState<FileShelfState>(emptyState);
  const [expanded, setExpanded] = useState(
    () => typeof window !== "undefined" && window.innerWidth > 100,
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [undoToken, setUndoToken] = useState("");
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [transientExpanded, setTransientExpanded] = useState(false);
  const [pendingDragItemIds, setPendingDragItemIds] = useState<string[]>([]);
  const loadRevision = useRef(0);
  const dragEnterRevision = useRef(0);

  const fail = useCallback((reason: unknown) => {
    setError(reason instanceof Error ? reason.message : String(reason));
  }, []);

  const load = useCallback(async () => {
    const revision = ++loadRevision.current;
    setLoading(true);
    setError("");
    try {
      const next = await loadFileShelfState();
      if (revision === loadRevision.current) setState(next);
    } catch (reason) {
      if (revision === loadRevision.current) fail(reason);
    } finally {
      if (revision === loadRevision.current) setLoading(false);
    }
  }, [fail]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeExpanded = useCallback(
    async (next: boolean, focus = next, transient = false) => {
      setError("");
      setTransientExpanded(next && transient);
      try {
        await setFileShelfExpanded(next, focus);
        setExpanded(next);
      } catch (reason) {
        setTransientExpanded(false);
        fail(reason);
      }
    },
    [fail],
  );

  const addPaths = useCallback(
    async (paths: string[]) => {
      if (!paths.length) return;
      setBusy(true);
      setError("");
      setNotice("");
      try {
        const mutation = await addFileShelfPaths({ paths });
        setState(mutation.state);
        setNotice(
          mutation.addedCount > 0
            ? `${mutation.addedCount}件を預かりました${mutation.skippedCount ? `（${mutation.skippedCount}件は追加済みまたは無効）` : ""}`
            : "追加できる新しい項目がありませんでした",
        );
      } catch (reason) {
        fail(reason);
      } finally {
        setBusy(false);
      }
    },
    [fail],
  );

  useEffect(() => {
    let unlistenMode: (() => void) | undefined;
    let unlistenDrop: (() => void) | undefined;
    let unlistenState: (() => void) | undefined;
    let unlistenNotice: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;
    let unlistenRecentRestore: (() => void) | undefined;
    void listen<boolean>("file-shelf-mode-changed", (event) => {
      setExpanded(event.payload);
      if (!event.payload) setTransientExpanded(false);
    }).then((cleanup) => {
      unlistenMode = cleanup;
    });
    void listen<FileShelfState>("file-shelf-state-changed", (event) => {
      setState(event.payload);
      setNotice("クリップボード履歴を更新しました");
    }).then((cleanup) => {
      unlistenState = cleanup;
    });
    void listen<string>("file-shelf-notice", (event) => {
      setError("");
      setNotice(event.payload);
    }).then((cleanup) => {
      unlistenNotice = cleanup;
    });
    void listen<string>("file-shelf-error", (event) => {
      setNotice("");
      setError(event.payload);
    }).then((cleanup) => {
      unlistenError = cleanup;
    });
    void listen<void>("file-shelf-recent-removal-restored", () => {
      setUndoToken("");
    }).then((cleanup) => {
      unlistenRecentRestore = cleanup;
    });
    void getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "enter" || event.payload.type === "over") {
          setIsDropTarget(true);
          if (event.payload.type === "enter") {
            const revision = ++dragEnterRevision.current;
            void shouldAutoExpandFileShelf()
              .then((shouldExpand) => {
                if (revision === dragEnterRevision.current && shouldExpand) {
                  void changeExpanded(true, false, true);
                }
              })
              .catch(() => {
                if (revision === dragEnterRevision.current) {
                  void changeExpanded(true, false, true);
                }
              });
          }
        } else if (event.payload.type === "leave") {
          dragEnterRevision.current += 1;
          setIsDropTarget(false);
        } else if (event.payload.type === "drop") {
          dragEnterRevision.current += 1;
          setIsDropTarget(false);
          void addPaths(event.payload.paths);
        }
      })
      .then((cleanup) => {
        unlistenDrop = cleanup;
      });
    return () => {
      unlistenMode?.();
      unlistenDrop?.();
      unlistenState?.();
      unlistenNotice?.();
      unlistenError?.();
      unlistenRecentRestore?.();
      dragEnterRevision.current += 1;
      setIsDropTarget(false);
    };
  }, [addPaths, changeExpanded]);

  useEffect(() => {
    if (!undoToken) return;
    const timer = window.setTimeout(() => setUndoToken(""), 10_000);
    return () => window.clearTimeout(timer);
  }, [undoToken]);

  useEffect(() => {
    const activeIds = new Set(
      state.groups.flatMap((group) => group.items.map((item) => item.id)),
    );
    setPendingDragItemIds((previous) =>
      previous.filter((itemId) => activeIds.has(itemId)),
    );
  }, [state.groups]);

  const addContent = useCallback(
    async (input: AddFileShelfContentInput) => {
      setBusy(true);
      setError("");
      setNotice("");
      try {
        const mutation = await addFileShelfContent(input);
        setState(mutation.state);
        setNotice("クリップボードから1件預かりました");
      } catch (reason) {
        fail(reason);
      } finally {
        setBusy(false);
      }
    },
    [fail],
  );

  const choosePaths = useCallback(async () => {
    try {
      const selection = await chooseFileShelfPaths();
      if (!selection) return;
      await addPaths(Array.isArray(selection) ? selection : [selection]);
    } catch (reason) {
      fail(reason);
    }
  }, [addPaths, fail]);

  const chooseFolders = useCallback(async () => {
    try {
      const selection = await chooseFileShelfFolders();
      if (!selection) return;
      await addPaths(Array.isArray(selection) ? selection : [selection]);
    } catch (reason) {
      fail(reason);
    }
  }, [addPaths, fail]);

  const removeItems = useCallback(
    async (itemIds: string[]) => {
      setBusy(true);
      setError("");
      try {
        const removal = await removeFileShelfItems(itemIds);
        setState(removal.state);
        setUndoToken(removal.undoToken);
        setNotice(`${itemIds.length}件を棚から外しました`);
      } catch (reason) {
        fail(reason);
      } finally {
        setBusy(false);
      }
    },
    [fail],
  );

  const clear = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const removal = await clearFileShelf();
      setState(removal.state);
      setUndoToken(removal.undoToken);
      setNotice("棚を空にしました");
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy(false);
    }
  }, [fail]);

  const clearClipboardHistory = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const removal = await clearFileShelfClipboardHistory();
      setState(removal.state);
      setUndoToken(removal.undoToken);
      setNotice("クリップボード履歴を消去しました");
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy(false);
    }
  }, [fail]);

  const undo = useCallback(async () => {
    if (!undoToken) return;
    setBusy(true);
    setError("");
    try {
      const next = await restoreFileShelfRemoval(undoToken);
      setState(next);
      setUndoToken("");
      setNotice("棚へ戻しました");
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy(false);
    }
  }, [fail, undoToken]);

  const restoreRecent = useCallback(async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await restoreRecentFileShelfRemoval();
      setState(next);
      setUndoToken("");
      setNotice("最近外した項目を棚へ戻しました");
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy(false);
    }
  }, [fail]);

  const pinItems = useCallback(
    async (items: FileShelfItem[], pinned: boolean) => {
      if (!items.length) return;
      setBusy(true);
      setError("");
      try {
        const next = await setFileShelfItemsPinned(
          items.map((item) => item.id),
          pinned,
        );
        setState(next);
        setNotice(
          pinned
            ? `${items.length}件を棚に固定しました`
            : `${items.length}件の固定を解除しました`,
        );
      } catch (reason) {
        fail(reason);
      } finally {
        setBusy(false);
      }
    },
    [fail],
  );

  const renameItem = useCallback(
    async (item: FileShelfItem, displayName: string) => {
      setBusy(true);
      setError("");
      try {
        const next = await renameFileShelfItem(item.id, displayName);
        setState(next);
        setNotice(`「${displayName.trim()}」として棚に表示します`);
        return true;
      } catch (reason) {
        fail(reason);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [fail],
  );

  const dragItems = useCallback(
    async (items: FileShelfItem[], move = false) => {
      const ready = items.filter(
        (item) => item.availability === "ready" && item.sourcePath,
      );
      if (!ready.length) {
        setError("文章とURLは、項目を選択してコピーしてください。");
        return;
      }
      const paths = ready.map((item) => item.sourcePath as string);

      setBusy(true);
      setError("");
      try {
        const result = await startFileShelfDrag(paths, move ? "move" : "copy");
        if (result === "Dropped") {
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
        }
      } catch (reason) {
        fail(reason);
      } finally {
        setBusy(false);
      }
    },
    [fail],
  );

  const confirmDraggedItems = useCallback(async () => {
    if (!pendingDragItemIds.length) return;
    setBusy(true);
    setError("");
    try {
      const removal = await removeFileShelfItems(pendingDragItemIds);
      setState(removal.state);
      setUndoToken(removal.undoToken);
      setPendingDragItemIds([]);
      setNotice(`${pendingDragItemIds.length}件を棚から外しました`);
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy(false);
    }
  }, [fail, pendingDragItemIds]);

  const keepDraggedItems = useCallback(() => {
    if (!pendingDragItemIds.length) return;
    const count = pendingDragItemIds.length;
    setPendingDragItemIds([]);
    setNotice(`${count}件を棚に残しました`);
  }, [pendingDragItemIds]);

  const copyItem = useCallback(
    async (item: FileShelfItem) => {
      const value = item.textContent ?? item.sourcePath;
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        setNotice("クリップボードへコピーしました");
      } catch (reason) {
        fail(reason);
      }
    },
    [fail],
  );

  const copyItems = useCallback(
    async (items: FileShelfItem[]) => {
      const values = items
        .map((item) => item.textContent ?? item.sourcePath)
        .filter((value): value is string => Boolean(value));
      if (!values.length) return;
      try {
        await navigator.clipboard.writeText(values.join("\n"));
        setNotice(`${values.length}件をクリップボードへコピーしました`);
      } catch (reason) {
        fail(reason);
      }
    },
    [fail],
  );

  const openItem = useCallback(
    async (item: FileShelfItem) => {
      try {
        if (item.kind === "url" && item.textContent) {
          await openFileShelfUrl(item.textContent);
        } else if (item.sourcePath) {
          await openFileShelfPath(item.sourcePath);
        }
      } catch (reason) {
        fail(reason);
      }
    },
    [fail],
  );

  const revealItem = useCallback(
    async (item: FileShelfItem) => {
      if (!item.sourcePath) return;
      try {
        await revealFileShelfPath(item.sourcePath);
      } catch (reason) {
        fail(reason);
      }
    },
    [fail],
  );

  const itemCount = useMemo(
    () => state.groups.reduce((sum, group) => sum + group.items.length, 0),
    [state.groups],
  );

  const clipboardHistoryCount = useMemo(
    () =>
      state.groups.reduce(
        (sum, group) =>
          sum +
          group.items.filter(
            (item) => item.source === "clipboardHistory" && !item.pinned,
          ).length,
        0,
      ),
    [state.groups],
  );

  const pinnedCount = useMemo(
    () =>
      state.groups.reduce(
        (sum, group) => sum + group.items.filter((item) => item.pinned).length,
        0,
      ),
    [state.groups],
  );

  return {
    state,
    expanded,
    loading,
    busy,
    error,
    notice,
    undoToken,
    isDropTarget,
    transientExpanded,
    itemCount,
    clipboardHistoryCount,
    pinnedCount,
    pendingDragCount: pendingDragItemIds.length,
    reportError: fail,
    changeExpanded,
    addPaths,
    addContent,
    choosePaths,
    chooseFolders,
    removeItems,
    clear,
    clearClipboardHistory,
    undo,
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
