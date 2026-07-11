import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  requiresImmediateSettingsSave,
  settingsAreEqual,
} from "../persistence/settingsChangePolicy";
import { parseShortcutErrors } from "../persistence/shortcutErrors";
import { loadSettings, saveSettings } from "../settings";
import type { AppSettings, SaveStatus, SettingsUpdate } from "../settingsModel";

const SAVE_DEBOUNCE_MS = 500;
const SAVE_SUCCESS_VISIBLE_MS = 2000;

export const useAppSettingsController = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [shortcutErrors, setShortcutErrors] = useState<Record<string, string>>(
    {},
  );

  const settingsRef = useRef<AppSettings | null>(null);
  const pendingSaveRef = useRef<AppSettings | null>(null);
  const failedSaveRef = useRef<AppSettings | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequenceRef = useRef(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveStatusRef = useRef<SaveStatus>("idle");

  const updateSaveStatus = useCallback((status: SaveStatus) => {
    saveStatusRef.current = status;
    setSaveStatus(status);
  }, []);

  const reloadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadSettings();
      setSettings(loaded);
      settingsRef.current = loaded;
    } catch (loadError) {
      console.error("Failed to load settings:", loadError);
      setError("設定の読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadSettings();

    const unlistenPromise = listen("settings-changed", async () => {
      const sequenceAtEvent = sequenceRef.current;
      try {
        const loaded = await loadSettings();
        if (
          sequenceRef.current !== sequenceAtEvent ||
          pendingSaveRef.current !== null
        ) {
          return;
        }
        setSettings((previous) => {
          if (!settingsAreEqual(previous, loaded)) {
            settingsRef.current = loaded;
            return loaded;
          }
          return previous;
        });
      } catch (loadError) {
        console.error("Failed to reload settings:", loadError);
      }
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [reloadSettings]);

  const commitSettings = useCallback(
    (settingsToSave: AppSettings, sequence: number) => {
      const queuedSave = saveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (sequenceRef.current === sequence) updateSaveStatus("saving");
          try {
            await saveSettings(settingsToSave);
            if (sequenceRef.current === sequence) {
              failedSaveRef.current = null;
              setError(null);
              setShortcutErrors({});
              updateSaveStatus("saved");
            }
          } catch (saveError) {
            const message =
              saveError instanceof Error
                ? saveError.message
                : String(saveError);
            console.error("Failed to save settings:", saveError);
            if (sequenceRef.current === sequence) {
              failedSaveRef.current = settingsToSave;
              setError("設定の保存に失敗しました");
              updateSaveStatus("error");
              setShortcutErrors(parseShortcutErrors(message));
            }
          }
        });
      saveQueueRef.current = queuedSave;
      return queuedSave;
    },
    [updateSaveStatus],
  );

  const flushPendingSettings = useCallback(async () => {
    if (!pendingSaveRef.current) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const settingsToSave = pendingSaveRef.current;
    pendingSaveRef.current = null;
    await commitSettings(settingsToSave, sequenceRef.current);
  }, [commitSettings]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      void flushPendingSettings();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      void flushPendingSettings();
    };
  }, [flushPendingSettings]);

  useEffect(() => {
    if (saveStatusTimerRef.current) {
      clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = null;
    }

    if (saveStatus === "saved") {
      saveStatusTimerRef.current = setTimeout(() => {
        updateSaveStatus("idle");
        saveStatusTimerRef.current = null;
      }, SAVE_SUCCESS_VISIBLE_MS);
    }

    return () => {
      if (saveStatusTimerRef.current) {
        clearTimeout(saveStatusTimerRef.current);
        saveStatusTimerRef.current = null;
      }
    };
  }, [saveStatus, updateSaveStatus]);

  const clearError = useCallback(() => setError(null), []);

  const retrySaveSettings = useCallback(async () => {
    const failedSettings = failedSaveRef.current;
    if (!failedSettings) return;

    failedSaveRef.current = null;
    setError(null);
    sequenceRef.current += 1;
    await commitSettings(failedSettings, sequenceRef.current);
  }, [commitSettings]);

  const updateSettings = useCallback(
    (update: SettingsUpdate) => {
      const previous = settingsRef.current;
      if (!previous) return;

      const next =
        typeof update === "function"
          ? update(previous)
          : { ...previous, ...update };
      if (settingsAreEqual(previous, next)) return;

      const saveImmediately = requiresImmediateSettingsSave(previous, next);
      settingsRef.current = next;
      setSettings(next);
      if (saveStatusRef.current === "error") {
        setError(null);
        updateSaveStatus("idle");
      }

      sequenceRef.current += 1;
      const sequence = sequenceRef.current;
      failedSaveRef.current = null;
      pendingSaveRef.current = next;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (saveImmediately) {
        const settingsToSave = pendingSaveRef.current;
        pendingSaveRef.current = null;
        void commitSettings(settingsToSave, sequence);
        return;
      }

      updateSaveStatus("pending");
      timerRef.current = setTimeout(() => {
        if (!pendingSaveRef.current) return;
        const settingsToSave = pendingSaveRef.current;
        pendingSaveRef.current = null;
        void commitSettings(settingsToSave, sequence);
      }, SAVE_DEBOUNCE_MS);
    },
    [commitSettings, updateSaveStatus],
  );

  return {
    settings,
    loading,
    error,
    saveStatus,
    shortcutErrors,
    clearError,
    reloadSettings,
    retrySaveSettings,
    updateSettings,
  };
};
