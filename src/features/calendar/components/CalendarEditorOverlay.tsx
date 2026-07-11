import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppSettings } from "../../../core/context/AppSettings";
import { OverlayCard, OverlayFrame } from "../../../design/layout";
import type { CalendarEvent } from "../types";
import { CalendarEventEditor } from "./CalendarEventEditor";
import "./CalendarOverlay.css";

type EditorState =
  | { kind: "create"; date: string }
  | { kind: "edit"; event: CalendarEvent }
  | { kind: "duplicate"; event: CalendarEvent };

interface EditorPayload {
  mode: string;
  date?: string;
  event?: CalendarEvent;
  template?: CalendarEvent;
}

const getTodayMachineDate = () => {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  return new Date(today.getTime() - offset * 60 * 1000)
    .toISOString()
    .split("T")[0];
};

export const CalendarEditorOverlay: React.FC = () => {
  const { settings } = useAppSettings();
  const themeColor = settings?.calendar.themeColor || "#10a37f";

  const [editorState, setEditorState] = useState<EditorState>(() => ({
    kind: "create",
    date: getTodayMachineDate(),
  }));
  const dirtyRef = useRef(false);

  const canClose = useCallback(
    () => !dirtyRef.current || window.confirm("未保存の変更を破棄しますか？"),
    [],
  );

  const closeEditor = useCallback(async () => {
    if (!canClose()) return;
    try {
      const appWindow = getCurrentWindow();
      await appWindow.hide();
    } catch (err) {
      console.warn("Failed to hide calendar editor window", err);
    }
  }, [canClose]);

  useEffect(() => {
    document.body.classList.add("is-overlay");
    document.documentElement.classList.add("is-overlay");

    // 1. Send ready event to Rust to get payload if it was already stored
    emit("calendar-editor-ready").catch(console.error);

    // 2. Also try retrieving it directly via invoke as a fallback
    invoke<EditorPayload>("get_calendar_editor_payload")
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

    const unlisten = listen<EditorPayload>("calendar-editor-shown", (event) => {
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
    });

    return () => {
      document.body.classList.remove("is-overlay");
      document.documentElement.classList.remove("is-overlay");
      unlisten.then((f) => f()).catch(console.error);
    };
  }, []);

  const handleDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  const handleSaved = useCallback(() => {
    dirtyRef.current = false;
    closeEditor().catch(console.error);
  }, [closeEditor]);

  useEffect(() => {
    (
      document.documentElement.style as CSSStyleDeclaration & { zoom: string }
    ).zoom = "";
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeEditor().catch(console.error);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeEditor]);

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
          onClick={closeEditor}
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
          onCancel={closeEditor}
          onDirtyChange={handleDirtyChange}
          onSaved={handleSaved}
        />
      </OverlayCard>
    </OverlayFrame>
  );
};
