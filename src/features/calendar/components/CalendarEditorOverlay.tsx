import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppSettings } from "../../../core/context/AppSettings";
import { defaultAppSettings } from "../../../core/defaultSettings";
import { useOverlayWindowEviction } from "../../../core/hooks/useOverlayWindowEviction";
import { ConfirmDialog } from "../../../design/components";
import { OverlayCard, OverlayFrame } from "../../../design/layout";
import {
  CALENDAR_EVENTS_CHANGED_EVENT,
  getCalendarEditorPayload,
} from "../events";
import type { CalendarEditorPayload, CalendarEvent } from "../types";
import { CalendarEventEditor } from "./CalendarEventEditor";
import "./CalendarOverlay.css";

type EditorState =
  | { kind: "create"; date: string }
  | { kind: "edit"; event: CalendarEvent }
  | { kind: "duplicate"; event: CalendarEvent };

const getTodayMachineDate = () => {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  return new Date(today.getTime() - offset * 60 * 1000)
    .toISOString()
    .split("T")[0];
};

export const CalendarEditorOverlay: React.FC = () => {
  const { settings } = useAppSettings();
  const themeColor =
    settings?.calendar.themeColor || defaultAppSettings.calendar.themeColor;

  const [editorState, setEditorState] = useState<EditorState>(() => ({
    kind: "create",
    date: getTodayMachineDate(),
  }));
  const dirtyRef = useRef(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [closeError, setCloseError] = useState("");
  const [editorSaving, setEditorSaving] = useState(false);
  const [windowVisible, setWindowVisible] = useState(true);

  const hideEditor = useCallback(async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.hide();
      setWindowVisible(false);
      return true;
    } catch (err) {
      console.warn("Failed to hide calendar editor window", err);
      return false;
    }
  }, []);

  const requestClose = useCallback(async () => {
    if (editorSaving) return;
    if (dirtyRef.current) {
      setCloseError("");
      setDiscardDialogOpen(true);
      return;
    }
    await hideEditor();
  }, [editorSaving, hideEditor]);

  const confirmDiscard = useCallback(async () => {
    setDiscarding(true);
    setCloseError("");
    const hidden = await hideEditor();
    if (hidden) {
      dirtyRef.current = false;
      setDiscardDialogOpen(false);
    } else {
      setCloseError(
        "予定入力画面を閉じられませんでした。もう一度お試しください。",
      );
    }
    setDiscarding(false);
  }, [hideEditor]);

  useEffect(() => {
    document.body.classList.add("is-overlay");
    document.documentElement.classList.add("is-overlay");

    // 1. Send ready event to Rust to get payload if it was already stored
    emit("calendar-editor-ready").catch(console.error);

    // 2. Also try retrieving it directly via invoke as a fallback
    getCalendarEditorPayload()
      .then((payload) => {
        if (!payload) return;
        if (payload.mode === "create") {
          setEditorState({
            kind: "create",
            date: payload.date || getTodayMachineDate(),
          });
        } else if (payload.mode === "edit" && payload.event) {
          setEditorState({ kind: "edit", event: payload.event });
        } else if (payload.mode === "duplicate" && payload.template) {
          setEditorState({ kind: "duplicate", event: payload.template });
        }
      })
      .catch((err) => {
        console.warn("Failed to get initial calendar editor payload", err);
      });

    const unlisten = listen<CalendarEditorPayload>(
      "calendar-editor-shown",
      (event) => {
        setWindowVisible(true);
        dirtyRef.current = false;
        setDiscardDialogOpen(false);
        setDiscarding(false);
        setCloseError("");
        setEditorSaving(false);
        const payload = event.payload;
        if (payload.mode === "create") {
          setEditorState({
            kind: "create",
            date: payload.date || getTodayMachineDate(),
          });
        } else if (payload.mode === "edit" && payload.event) {
          setEditorState({ kind: "edit", event: payload.event });
        } else if (payload.mode === "duplicate" && payload.template) {
          setEditorState({ kind: "duplicate", event: payload.template });
        } else {
          setEditorState({
            kind: "create",
            date: getTodayMachineDate(),
          });
        }
      },
    );

    return () => {
      document.body.classList.remove("is-overlay");
      document.documentElement.classList.remove("is-overlay");
      unlisten.then((f) => f()).catch(console.error);
    };
  }, []);

  useOverlayWindowEviction(windowVisible);

  const handleDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  const handleSaved = useCallback(
    (savedEvent: CalendarEvent) => {
      dirtyRef.current = false;
      void emit(CALENDAR_EVENTS_CHANGED_EVENT, { event: savedEvent }).catch(
        (error) => {
          console.warn("Failed to notify calendar event changes", error);
        },
      );
      void hideEditor();
    },
    [hideEditor],
  );

  useEffect(() => {
    (
      document.documentElement.style as CSSStyleDeclaration & { zoom: string }
    ).zoom = "";
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!discardDialogOpen) void requestClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [discardDialogOpen, requestClose]);

  return (
    <OverlayFrame>
      <OverlayCard
        className="calendar-overlay-card theme-accent-scope is-visible"
        role="dialog"
        aria-label="カレンダー予定エディタ"
        style={{ "--color-accent": themeColor } as React.CSSProperties}
      >
        <button
          type="button"
          className="overlay-close-button"
          aria-label="エディタを閉じる"
          aria-keyshortcuts="Escape"
          title="閉じる（Esc）"
          disabled={editorSaving}
          onClick={() => void requestClose()}
        >
          <X size={15} aria-hidden="true" />
        </button>

        <CalendarEventEditor
          event={editorState.kind === "edit" ? editorState.event : undefined}
          template={
            editorState.kind === "duplicate" ? editorState.event : undefined
          }
          initialDate={
            editorState.kind === "create" ? editorState.date : undefined
          }
          onCancel={() => void requestClose()}
          onDirtyChange={handleDirtyChange}
          onSavingChange={setEditorSaving}
          onSaved={handleSaved}
        />
      </OverlayCard>
      <ConfirmDialog
        open={discardDialogOpen}
        title="未保存の変更を破棄しますか？"
        description="入力した内容は保存されていません。画面を閉じると元に戻せません。"
        confirmLabel="破棄して閉じる"
        busy={discarding}
        busyLabel="閉じています…"
        error={closeError}
        onCancel={() => {
          setDiscardDialogOpen(false);
          setCloseError("");
        }}
        onConfirm={() => void confirmDiscard()}
      />
    </OverlayFrame>
  );
};
