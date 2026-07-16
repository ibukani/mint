import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useCallback, useEffect, useRef, useState } from "react";
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

interface FileShelfSummary {
  itemCount: number;
  clipboardHistoryCount: number;
  pinnedCount: number;
}

const emptySummary: FileShelfSummary = {
  itemCount: 0,
  clipboardHistoryCount: 0,
  pinnedCount: 0,
};

const summarizeState = (next: FileShelfState): FileShelfSummary => {
  let itemCount = 0;
  let clipboardHistoryCount = 0;
  let pinnedCount = 0;
  for (const group of next.groups) {
    itemCount += group.items.length;
    for (const item of group.items) {
      if (item.source === "clipboardHistory" && !item.pinned) {
        clipboardHistoryCount += 1;
      }
      if (item.pinned) pinnedCount += 1;
    }
  }
  return { itemCount, clipboardHistoryCount, pinnedCount };
};

export const useFileShelf = () => {
  const [state, setState] = useState<FileShelfState>(emptyState);
  const initialExpanded =
    typeof window !== "undefined" && window.innerWidth > 100;
  const [expanded, setExpanded] = useState(initialExpanded);
  const [summary, setSummary] = useState<FileShelfSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [undoToken, setUndoToken] = useState("");
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [transientExpanded, setTransientExpanded] = useState(false);
  const [pendingDragItemIds, setPendingDragItemIds] = useState<string[]>([]);
  const operationRevision = useRef(0);
  const dragEnterRevision = useRef(0);
  const expandedRef = useRef(initialExpanded);
  const summaryLoadedRef = useRef(false);
  const stateLoadedRef = useRef(false);

  const applyState = useCallback((next: FileShelfState) => {
    setSummary(summarizeState(next));
    summaryLoadedRef.current = true;
    if (expandedRef.current) {
      setState(next);
      stateLoadedRef.current = true;
    } else {
      setState(emptyState);
      stateLoadedRef.current = false;
    }
  }, []);

  const fail = useCallback((reason: unknown) => {
    setError(reason instanceof Error ? reason.message : String(reason));
  }, []);

  const load = useCallback(async () => {
    const revision = ++operationRevision.current;
    setLoading(true);
    setError("");
    try {
      const next = await loadFileShelfState();
      if (revision === operationRevision.current) applyState(next);
    } catch (reason) {
      if (revision === operationRevision.current) fail(reason);
    } finally {
      if (revision === operationRevision.current) setLoading(false);
    }
  }, [applyState, fail]);

  useEffect(() => {
    if (expanded && stateLoadedRef.current) return;
    if (!expanded && summaryLoadedRef.current) return;
    void load();
  }, [expanded, load]);

  const changeExpanded = useCallback(
    async (next: boolean, focus = next, transient = false) => {
      setError("");
      setTransientExpanded(next && transient);
      try {
        await setFileShelfExpanded(next, focus);
        expandedRef.current = next;
        setExpanded(next);
        if (!next) {
          stateLoadedRef.current = false;
          setState(emptyState);
        }
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
      const revision = ++operationRevision.current;
      setBusy(true);
      setError("");
      setNotice("");
      try {
        const mutation = await addFileShelfPaths({ paths });
        if (revision === operationRevision.current) {
          applyState(mutation.state);
          setNotice(
            mutation.addedCount > 0
              ? `${mutation.addedCount}件を預かりました${mutation.skippedCount ? `（${mutation.skippedCount}件は追加済みまたは無効）` : ""}`
              : "追加できる新しい項目がありませんでした",
          );
        }
      } catch (reason) {
        if (revision === operationRevision.current) fail(reason);
      } finally {
        if (revision === operationRevision.current) setBusy(false);
      }
    },
    [applyState, fail],
  );

  useEffect(() => {
    let unlistenMode: (() => void) | undefined;
    let unlistenDrop: (() => void) | undefined;
    let unlistenState: (() => void) | undefined;
    let unlistenNotice: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;
    let unlistenRecentRestore: (() => void) | undefined;
    void listen<boolean>("file-shelf-mode-changed", (event) => {
      expandedRef.current = event.payload;
      setExpanded(event.payload);
      if (!event.payload) {
        stateLoadedRef.current = false;
        setState(emptyState);
        setTransientExpanded(false);
      }
    }).then((cleanup) => {
      unlistenMode = cleanup;
    });
    void listen<FileShelfState>("file-shelf-state-changed", (event) => {
      applyState(event.payload);
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
  }, [addPaths, applyState, changeExpanded]);

  useEffect(() => {
    if (!undoToken) return;
    const timer = window.setTimeout(() => setUndoToken(""), 10_000);
    return () => window.clearTimeout(timer);
  }, [undoToken]);

  useEffect(() => {
    const activeIds = new Set(
      state.groups.flatMap((group) => group.items.map((item) => item.id)),
    );
    setPendingDragItemIds((previous) => {
      if (previous.length === 0) return previous;
      const next = previous.filter((itemId) => activeIds.has(itemId));
      return next.length === previous.length ? previous : next;
    });
  }, [state.groups]);

  const addContent = useCallback(
    async (input: AddFileShelfContentInput) => {
      const revision = ++operationRevision.current;
      setBusy(true);
      setError("");
      setNotice("");
      try {
        const mutation = await addFileShelfContent(input);
        if (revision === operationRevision.current) {
          applyState(mutation.state);
          setNotice("クリップボードから1件預かりました");
        }
      } catch (reason) {
        if (revision === operationRevision.current) fail(reason);
      } finally {
        if (revision === operationRevision.current) setBusy(false);
      }
    },
    [applyState, fail],
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
      const revision = ++operationRevision.current;
      setBusy(true);
      setError("");
      try {
        const removal = await removeFileShelfItems(itemIds);
        if (revision === operationRevision.current) {
          applyState(removal.state);
          setUndoToken(removal.undoToken);
          setNotice(`${itemIds.length}件を棚から外しました`);
        }
      } catch (reason) {
        if (revision === operationRevision.current) fail(reason);
      } finally {
        if (revision === operationRevision.current) setBusy(false);
      }
    },
    [applyState, fail],
  );

  const clear = useCallback(async () => {
    const revision = ++operationRevision.current;
    setBusy(true);
    setError("");
    try {
      const removal = await clearFileShelf();
      if (revision === operationRevision.current) {
        applyState(removal.state);
        setUndoToken(removal.undoToken);
        setNotice("棚を空にしました");
      }
    } catch (reason) {
      if (revision === operationRevision.current) fail(reason);
    } finally {
      if (revision === operationRevision.current) setBusy(false);
    }
  }, [applyState, fail]);

  const clearClipboardHistory = useCallback(async () => {
    const revision = ++operationRevision.current;
    setBusy(true);
    setError("");
    try {
      const removal = await clearFileShelfClipboardHistory();
      if (revision === operationRevision.current) {
        applyState(removal.state);
        setUndoToken(removal.undoToken);
        setNotice("クリップボード履歴を消去しました");
      }
    } catch (reason) {
      if (revision === operationRevision.current) fail(reason);
    } finally {
      if (revision === operationRevision.current) setBusy(false);
    }
  }, [applyState, fail]);

  const undo = useCallback(async () => {
    if (!undoToken) return;
    const revision = ++operationRevision.current;
    setBusy(true);
    setError("");
    try {
      const next = await restoreFileShelfRemoval(undoToken);
      if (revision === operationRevision.current) {
        applyState(next);
        setUndoToken("");
        setNotice("棚へ戻しました");
      }
    } catch (reason) {
      if (revision === operationRevision.current) fail(reason);
    } finally {
      if (revision === operationRevision.current) setBusy(false);
    }
  }, [applyState, fail, undoToken]);

  const restoreRecent = useCallback(async () => {
    const revision = ++operationRevision.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await restoreRecentFileShelfRemoval();
      if (revision === operationRevision.current) {
        applyState(next);
        setUndoToken("");
        setNotice("最近外した項目を棚へ戻しました");
      }
    } catch (reason) {
      if (revision === operationRevision.current) fail(reason);
    } finally {
      if (revision === operationRevision.current) setBusy(false);
    }
  }, [applyState, fail]);

  const pinItems = useCallback(
    async (items: FileShelfItem[], pinned: boolean) => {
      if (!items.length) return;
      const revision = ++operationRevision.current;
      setBusy(true);
      setError("");
      try {
        const next = await setFileShelfItemsPinned(
          items.map((item) => item.id),
          pinned,
        );
        if (revision === operationRevision.current) {
          applyState(next);
          setNotice(
            pinned
              ? `${items.length}件を棚に固定しました`
              : `${items.length}件の固定を解除しました`,
          );
        }
      } catch (reason) {
        if (revision === operationRevision.current) fail(reason);
      } finally {
        if (revision === operationRevision.current) setBusy(false);
      }
    },
    [applyState, fail],
  );

  const renameItem = useCallback(
    async (item: FileShelfItem, displayName: string) => {
      const revision = ++operationRevision.current;
      setBusy(true);
      setError("");
      try {
        const next = await renameFileShelfItem(item.id, displayName);
        if (revision === operationRevision.current) {
          applyState(next);
          setNotice(`「${displayName.trim()}」として棚に表示します`);
        }
        return true;
      } catch (reason) {
        if (revision === operationRevision.current) fail(reason);
        return false;
      } finally {
        if (revision === operationRevision.current) setBusy(false);
      }
    },
    [applyState, fail],
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
    const revision = ++operationRevision.current;
    setBusy(true);
    setError("");
    try {
      const removal = await removeFileShelfItems(pendingDragItemIds);
      if (revision === operationRevision.current) {
        applyState(removal.state);
        setUndoToken(removal.undoToken);
        setPendingDragItemIds([]);
        setNotice(`${pendingDragItemIds.length}件を棚から外しました`);
      }
    } catch (reason) {
      if (revision === operationRevision.current) fail(reason);
    } finally {
      if (revision === operationRevision.current) setBusy(false);
    }
  }, [applyState, fail, pendingDragItemIds]);

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
    itemCount: summary.itemCount,
    clipboardHistoryCount: summary.clipboardHistoryCount,
    pinnedCount: summary.pinnedCount,
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
