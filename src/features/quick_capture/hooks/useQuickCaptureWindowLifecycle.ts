import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import { useOverlayWindowEviction } from "../../../core/hooks/useOverlayWindowEviction";
import { useOverlayWindowReady } from "../../../core/hooks/useOverlayWindowReady";
import type { QuickCaptureNoteCreatedPayload } from "../events";
import { QUICK_CAPTURE_NOTE_CREATED_EVENT } from "../events";
import type { CaptureSaveStatus } from "./useQuickCapture";

interface QuickCaptureWindowLifecycleOptions {
  persist: () => Promise<boolean>;
  reload: () => Promise<string | null>;
  reloadNotes: () => Promise<void>;
  showDraft: () => void;
  releaseNotes: () => void;
  addNote: (note: QuickCaptureNoteCreatedPayload["note"]) => void;
  setError: (error: string | null) => void;
  setStatus: (status: CaptureSaveStatus) => void;
  setCanRetrySave: (canRetry: boolean) => void;
}

export const useQuickCaptureWindowLifecycle = ({
  persist,
  reload,
  reloadNotes,
  showDraft,
  releaseNotes,
  addNote,
  setError,
  setStatus,
  setCanRetrySave,
}: QuickCaptureWindowLifecycleOptions) => {
  const [windowPinned, setWindowPinnedState] = useState(false);
  const [windowVisible, setWindowVisible] = useState(false);
  const initialLoadPromiseRef = useRef<Promise<string | null> | null>(null);
  const initialShownRef = useRef(false);
  const notesReleasedRef = useRef(false);
  const closeRef = useRef<() => Promise<void>>(async () => {});
  const windowPinnedRef = useRef(false);
  const visibleRef = useRef(false);
  const focusedRef = useRef(true);
  const closingRef = useRef(false);
  const autoHideSuppressionDepthRef = useRef(0);
  const autoHideSuppressedRef = useRef(false);

  const setWindowPinned = useCallback((value: boolean) => {
    windowPinnedRef.current = value;
    setWindowPinnedState(value);
  }, []);

  const withAutoHideSuspended = useCallback(
    async <Result>(operation: () => Promise<Result>): Promise<Result> => {
      autoHideSuppressionDepthRef.current += 1;
      autoHideSuppressedRef.current = true;
      try {
        return await operation();
      } finally {
        autoHideSuppressionDepthRef.current = Math.max(
          0,
          autoHideSuppressionDepthRef.current - 1,
        );
        if (autoHideSuppressionDepthRef.current === 0 && focusedRef.current) {
          autoHideSuppressedRef.current = false;
        }
      }
    },
    [],
  );

  const close = useCallback(async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    try {
      const saved = await persist();
      if (!saved) return;
      visibleRef.current = false;
      setWindowVisible(false);
      try {
        await getCurrentWindow().hide();
        notesReleasedRef.current = true;
        releaseNotes();
      } catch (reason) {
        visibleRef.current = true;
        setWindowVisible(true);
        setError(reason instanceof Error ? reason.message : String(reason));
        setStatus("error");
        setCanRetrySave(false);
      }
    } finally {
      closingRef.current = false;
    }
  }, [persist, releaseNotes, setCanRetrySave, setError, setStatus]);

  closeRef.current = close;

  useEffect(() => {
    const currentWindow = getCurrentWindow();
    const loadInitialState = () => {
      if (initialLoadPromiseRef.current) return;
      initialLoadPromiseRef.current = reload();
    };

    void currentWindow
      .isVisible()
      .then((visible) => {
        if (visible !== false) {
          visibleRef.current = true;
          setWindowVisible(true);
          loadInitialState();
        }
      })
      .catch(() => {
        visibleRef.current = true;
        setWindowVisible(true);
        loadInitialState();
      });

    document.body.classList.add("is-overlay");
    document.documentElement.classList.add("is-overlay");
    const shown = listen("quick-capture-shown", () => {
      const firstShown = !initialShownRef.current;
      initialShownRef.current = true;
      visibleRef.current = true;
      setWindowVisible(true);
      focusedRef.current = true;
      if (autoHideSuppressionDepthRef.current === 0) {
        autoHideSuppressedRef.current = false;
      }
      showDraft();
      if (!firstShown || notesReleasedRef.current) {
        notesReleasedRef.current = false;
        void reloadNotes();
      } else {
        const initialLoad = initialLoadPromiseRef.current;
        if (initialLoad) {
          void initialLoad.then((error) => {
            if (error) void reload();
          });
        } else {
          loadInitialState();
        }
      }
    });
    const noteCreated = listen<QuickCaptureNoteCreatedPayload>(
      QUICK_CAPTURE_NOTE_CREATED_EVENT,
      ({ payload }) => {
        const note = payload?.note;
        if (note) addNote(note);
      },
    );
    const hide = listen(
      "quick-capture-hide-requested",
      () => void closeRef.current(),
    );
    const focus = currentWindow.onFocusChanged(({ payload }) => {
      focusedRef.current = payload;
      if (payload) {
        if (autoHideSuppressionDepthRef.current === 0) {
          autoHideSuppressedRef.current = false;
        }
        return;
      }
      if (autoHideSuppressionDepthRef.current > 0) {
        autoHideSuppressedRef.current = true;
      }
      if (
        visibleRef.current &&
        !windowPinnedRef.current &&
        !closingRef.current &&
        !autoHideSuppressedRef.current
      ) {
        void closeRef.current();
      }
    });
    const closeRequested =
      typeof currentWindow.onCloseRequested === "function"
        ? currentWindow.onCloseRequested(() => void closeRef.current())
        : null;

    return () => {
      document.body.classList.remove("is-overlay");
      document.documentElement.classList.remove("is-overlay");
      void shown.then((unlisten) => unlisten());
      void noteCreated.then((unlisten) => unlisten());
      void hide.then((unlisten) => unlisten());
      void focus.then((unlisten) => unlisten());
      if (closeRequested) {
        void closeRequested.then((unlisten) => unlisten());
      }
    };
  }, [addNote, reload, reloadNotes, showDraft]);

  useOverlayWindowEviction(windowVisible);
  useOverlayWindowReady();

  return {
    close,
    setWindowPinned,
    windowPinned,
    windowVisible,
    withAutoHideSuspended,
  };
};
