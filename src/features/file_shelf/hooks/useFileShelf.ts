import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadFileShelfState,
  setFileShelfExpanded,
  shouldAutoExpandFileShelf,
} from "../api";
import type { FileShelfState } from "../types";
import { useFileShelfActions } from "./useFileShelfActions";

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

  const actions = useFileShelfActions({
    operationRevision,
    applyState,
    reportError: fail,
    setBusy,
    setError,
    setNotice,
    setUndoToken,
    undoToken,
    pendingDragItemIds,
    setPendingDragItemIds,
  });

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
          void actions.addPaths(event.payload.paths);
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
  }, [actions.addPaths, applyState, changeExpanded]);

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
    ...actions,
  };
};

export type FileShelfController = ReturnType<typeof useFileShelf>;
