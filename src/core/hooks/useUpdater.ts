import { relaunch } from "@tauri-apps/plugin-process";
import {
  check,
  type DownloadEvent,
  type Update,
} from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useRef, useState } from "react";

export type UpdaterStatus =
  | "idle"
  | "checking"
  | "available"
  | "upToDate"
  | "downloading"
  | "installing"
  | "installed"
  | "restartRequired"
  | "unsupported"
  | "error";

const isTauriRuntime =
  typeof window !== "undefined" &&
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !==
    undefined;
const isMockUpdatePreview =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("mockUpdate");

const checkErrorMessage =
  "更新情報を取得できませんでした。ネットワーク接続を確認して、もう一度お試しください。";
const installErrorMessage =
  "アップデートを完了できませんでした。アプリを再起動して、もう一度お試しください。";

export interface UpdaterState {
  status: UpdaterStatus;
  update: Update | null;
  progress: number | null;
  error: string | null;
  checkForUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
}

export const useUpdater = (): UpdaterState => {
  const [status, setStatus] = useState<UpdaterStatus>(
    isTauriRuntime ? "idle" : "unsupported",
  );
  const [update, setUpdate] = useState<Update | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const updateRef = useRef<Update | null>(null);
  const checkSequenceRef = useRef(0);
  const installingRef = useRef(false);

  const checkForUpdate = useCallback(async () => {
    if (!isTauriRuntime) {
      setStatus("unsupported");
      return;
    }

    const sequence = ++checkSequenceRef.current;
    const previousUpdate = updateRef.current;
    updateRef.current = null;
    setUpdate(null);
    if (previousUpdate) {
      void previousUpdate.close().catch(() => undefined);
    }

    setStatus("checking");
    setError(null);
    setProgress(null);

    try {
      const nextUpdate = await check({ timeout: 15_000 });
      if (sequence !== checkSequenceRef.current) {
        if (nextUpdate) void nextUpdate.close().catch(() => undefined);
        return;
      }
      updateRef.current = nextUpdate;
      setUpdate(nextUpdate);
      setStatus(nextUpdate ? "available" : "upToDate");
    } catch (checkError) {
      if (sequence !== checkSequenceRef.current) return;
      console.error("Failed to check for updates", checkError);
      setStatus("error");
      setError(checkErrorMessage);
    }
  }, []);

  const installUpdate = useCallback(async () => {
    const currentUpdate = updateRef.current;
    if (!currentUpdate || installingRef.current) return;

    installingRef.current = true;
    setStatus("downloading");
    setError(null);
    let downloadedBytes = 0;
    let contentLength: number | undefined;

    const onDownloadEvent = (event: DownloadEvent) => {
      if (event.event === "Started") {
        contentLength = event.data.contentLength;
        setProgress(null);
      } else if (event.event === "Progress") {
        downloadedBytes += event.data.chunkLength;
        if (contentLength) {
          setProgress(Math.min(100, (downloadedBytes / contentLength) * 100));
        }
      } else {
        setProgress(100);
        setStatus("installing");
      }
    };

    try {
      await currentUpdate.downloadAndInstall(onDownloadEvent);
      setStatus("installed");
      try {
        await relaunch();
      } catch (relaunchError) {
        console.error(
          "Failed to relaunch after installing update",
          relaunchError,
        );
        setStatus("restartRequired");
        setError(
          "アップデートはインストール済みです。アプリを手動で再起動してください。",
        );
      }
    } catch (installError) {
      console.error("Failed to install update", installError);
      setStatus("error");
      setError(installErrorMessage);
    } finally {
      installingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // Checking automatically is useful only in a packaged app. In development,
    // the release endpoint normally does not contain an artifact for the dev build.
    if (isTauriRuntime && (!import.meta.env.DEV || isMockUpdatePreview)) {
      void checkForUpdate();
    }

    return () => {
      checkSequenceRef.current += 1;
      const currentUpdate = updateRef.current;
      updateRef.current = null;
      if (currentUpdate) void currentUpdate.close().catch(() => undefined);
    };
  }, [checkForUpdate]);

  return {
    status,
    update,
    progress,
    error,
    checkForUpdate,
    installUpdate,
  };
};
