import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  addQuickCaptureAttachment,
  chooseQuickCaptureAttachment,
  deleteQuickCaptureAttachment,
} from "../api";
import type { QuickCaptureNote } from "../types";
import type { CaptureSaveStatus } from "./useQuickCapture";

interface UseQuickCaptureAttachmentsOptions {
  activeId: string | null;
  setNotes: React.Dispatch<React.SetStateAction<QuickCaptureNote[]>>;
  setStatus: React.Dispatch<React.SetStateAction<CaptureSaveStatus>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setCanRetrySave: React.Dispatch<React.SetStateAction<boolean>>;
  setCanRetryDuplicate: React.Dispatch<React.SetStateAction<boolean>>;
  withAutoHideSuspended: <Result>(
    operation: () => Promise<Result>,
  ) => Promise<Result>;
}

export const useQuickCaptureAttachments = ({
  activeId,
  setNotes,
  setStatus,
  setError,
  setCanRetrySave,
  setCanRetryDuplicate,
  withAutoHideSuspended,
}: UseQuickCaptureAttachmentsOptions) => {
  const [isDropTarget, setIsDropTarget] = useState(false);
  const attachmentInFlightRef = useRef(false);

  const addAttachmentFromPath = useCallback(
    async (noteId: string, sourcePath: string) => {
      const attachment = await addQuickCaptureAttachment({
        noteId,
        sourcePath,
      });
      setNotes((current) =>
        current.map((note) =>
          note.id === noteId
            ? { ...note, attachments: [...note.attachments, attachment] }
            : note,
        ),
      );
    },
    [setNotes],
  );

  const attachPaths = useCallback(
    async (paths: string[]) => {
      const noteId = activeId;
      const normalizedPaths = [
        ...new Set(paths.map((path) => path.trim()).filter(Boolean)),
      ];
      if (
        !noteId ||
        normalizedPaths.length === 0 ||
        attachmentInFlightRef.current
      ) {
        return;
      }

      attachmentInFlightRef.current = true;
      setStatus("saving");
      setError(null);
      setCanRetrySave(false);
      setCanRetryDuplicate(false);
      let addedCount = 0;
      try {
        for (const sourcePath of normalizedPaths) {
          await addAttachmentFromPath(noteId, sourcePath);
          addedCount += 1;
        }
        setStatus("saved");
      } catch (reason) {
        setError(
          addedCount > 0
            ? `${addedCount}件を添付しましたが、残りのファイルを追加できませんでした。再度ドロップしてください。`
            : reason instanceof Error
              ? reason.message
              : String(reason),
        );
        setStatus("error");
      } finally {
        attachmentInFlightRef.current = false;
      }
    },
    [
      activeId,
      addAttachmentFromPath,
      setCanRetryDuplicate,
      setCanRetrySave,
      setError,
      setStatus,
    ],
  );

  const addAttachment = useCallback(async () => {
    if (!activeId || attachmentInFlightRef.current) return;
    try {
      const sourcePath = await withAutoHideSuspended(() =>
        chooseQuickCaptureAttachment(),
      );
      if (!sourcePath || Array.isArray(sourcePath)) return;
      await attachPaths([sourcePath]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setStatus("error");
      setCanRetrySave(false);
    }
  }, [
    activeId,
    attachPaths,
    setCanRetrySave,
    setError,
    setStatus,
    withAutoHideSuspended,
  ]);

  const handleDroppedPaths = useCallback(
    (paths: string[]) => {
      if (paths.length === 0) return;
      if (!activeId) {
        setError(
          "ファイルを添付するには、先に保存済みメモを選択してください。",
        );
        setStatus("error");
        setCanRetrySave(false);
        return;
      }
      void attachPaths(paths);
    },
    [activeId, attachPaths, setCanRetrySave, setError, setStatus],
  );

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const listenForFileDrop = async () => {
      try {
        const currentWindow = getCurrentWindow();
        if (typeof currentWindow.onDragDropEvent !== "function") return;

        const cleanup = await currentWindow.onDragDropEvent((event) => {
          if (disposed) return;
          const { payload } = event;
          if (payload.type === "leave") {
            setIsDropTarget(false);
            return;
          }
          if (payload.type === "drop") {
            setIsDropTarget(false);
            handleDroppedPaths(payload.paths);
            return;
          }
          setIsDropTarget(activeId !== null);
        });

        if (disposed) cleanup();
        else unlisten = cleanup;
      } catch (reason) {
        console.warn(
          "Failed to register quick capture file drop listener:",
          reason,
        );
      }
    };

    void listenForFileDrop();
    return () => {
      disposed = true;
      setIsDropTarget(false);
      unlisten?.();
    };
  }, [activeId, handleDroppedPaths]);

  const removeAttachment = useCallback(
    async (attachmentId: string) => {
      if (!activeId) return;
      try {
        await deleteQuickCaptureAttachment(activeId, attachmentId);
        setNotes((current) =>
          current.map((note) =>
            note.id === activeId
              ? {
                  ...note,
                  attachments: note.attachments.filter(
                    (attachment) => attachment.id !== attachmentId,
                  ),
                }
              : note,
          ),
        );
        setStatus("saved");
        setError(null);
        setCanRetrySave(false);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
        setStatus("error");
        setCanRetrySave(false);
      }
    },
    [activeId, setCanRetrySave, setError, setNotes, setStatus],
  );

  return { addAttachment, isDropTarget, removeAttachment };
};
