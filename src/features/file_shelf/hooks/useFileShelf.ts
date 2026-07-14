import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addFileShelfContent,
  addFileShelfPaths,
  chooseFileShelfPaths,
  clearFileShelf,
  clearFileShelfClipboardHistory,
  loadFileShelfState,
  openFileShelfPath,
  openFileShelfUrl,
  removeFileShelfItems,
  restoreFileShelfRemoval,
  revealFileShelfPath,
  setFileShelfExpanded,
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
  const loadRevision = useRef(0);

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
    async (next: boolean, focus = next) => {
      setError("");
      try {
        await setFileShelfExpanded(next, focus);
        setExpanded(next);
      } catch (reason) {
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
    void listen<boolean>("file-shelf-mode-changed", (event) => {
      setExpanded(event.payload);
    }).then((cleanup) => {
      unlistenMode = cleanup;
    });
    void listen<FileShelfState>("file-shelf-state-changed", (event) => {
      setState(event.payload);
      setNotice("クリップボード履歴を更新しました");
    }).then((cleanup) => {
      unlistenState = cleanup;
    });
    void getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "enter") {
          void changeExpanded(true, false);
        } else if (event.payload.type === "drop") {
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
    };
  }, [addPaths, changeExpanded]);

  useEffect(() => {
    if (!undoToken) return;
    const timer = window.setTimeout(() => setUndoToken(""), 10_000);
    return () => window.clearTimeout(timer);
  }, [undoToken]);

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
          const removal = await removeFileShelfItems(
            ready.map((item) => item.id),
          );
          setState(removal.state);
          setUndoToken(removal.undoToken);
          setNotice(`${ready.length}件を取り出しました`);
        }
      } catch (reason) {
        fail(reason);
      } finally {
        setBusy(false);
      }
    },
    [fail],
  );

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
          group.items.filter((item) => item.source === "clipboardHistory")
            .length,
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
    itemCount,
    clipboardHistoryCount,
    reportError: fail,
    changeExpanded,
    addPaths,
    addContent,
    choosePaths,
    removeItems,
    clear,
    clearClipboardHistory,
    undo,
    dragItems,
    copyItem,
    copyItems,
    openItem,
    revealItem,
  };
};
