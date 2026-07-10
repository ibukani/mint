import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { CalendarSettings } from "../../features/calendar/types";
import type { ClockSettings } from "../../features/clock/types";
import type { VoiceToTextSettings } from "../../features/v2t/types";

export interface AppSettings {
  calendar: CalendarSettings;
  autostart: boolean;
  theme: "dark" | "light";
  settingsShortcut: string;
  clock: ClockSettings;
  voiceToText: VoiceToTextSettings;
}

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

interface AppSettingsContextType {
  settings: AppSettings | null;
  loading: boolean;
  error: string | null;
  saveStatus: SaveStatus;
  shortcutErrors: Record<string, string>;
  clearError: () => void;
  reloadSettings: () => Promise<void>;
  updateSettings: (
    newSettings: Partial<AppSettings> | ((prev: AppSettings) => AppSettings),
  ) => void;
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(
  undefined,
);

const SAVE_DEBOUNCE_MS = 500;
const SAVE_SUCCESS_VISIBLE_MS = 2000;
const SAVE_ERROR_VISIBLE_MS = 5000;

export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [shortcutErrors, setShortcutErrors] = useState<Record<string, string>>(
    {},
  );

  // Reference to the latest requested settings state
  const settingsRef = useRef<AppSettings | null>(null);
  const pendingSaveRef = useRef<AppSettings | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequenceRef = useRef<number>(0);

  const reloadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await invoke<AppSettings>("load_settings");
      setSettings(loaded);
      settingsRef.current = loaded;
    } catch (err) {
      console.error("Failed to load settings:", err);
      setError("設定の読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadSettings();

    const unlistenPromise = listen("settings-changed", async () => {
      try {
        const loaded = await invoke<AppSettings>("load_settings");
        setSettings((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(loaded)) {
            settingsRef.current = loaded;
            return loaded;
          }
          return prev;
        });
      } catch (err) {
        console.error("Failed to reload settings:", err);
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [reloadSettings]);

  const parseAndSetErrors = useCallback((errorMessage: string) => {
    const newErrors: Record<string, string> = {};
    try {
      const parsed = JSON.parse(errorMessage);
      if (parsed.type === "duplicateShortcut") {
        for (const feature of parsed.features) {
          newErrors[feature] = "ショートカットキーが重複しています";
        }
      } else if (parsed.type === "registrationFailed") {
        newErrors[parsed.feature] = parsed.message;
      }
    } catch {
      // Fallback for old hardcoded strings
      if (errorMessage.includes("重複")) {
        newErrors.clock = "ショートカットキーが重複しています";
        newErrors.calendar = "ショートカットキーが重複しています";
        newErrors.calendarCreateEvent = "ショートカットキーが重複しています";
        newErrors.voiceToText = "ショートカットキーが重複しています";
      } else if (errorMessage.includes("時計")) {
        newErrors.clock = errorMessage;
      } else if (errorMessage.includes("音声入力")) {
        newErrors.voiceToText = errorMessage;
      } else if (errorMessage.includes("カレンダー")) {
        newErrors.calendar = errorMessage;
      }
    }
    setShortcutErrors(newErrors);
  }, []);

  const commitSettings = useCallback(
    async (toSave: AppSettings, seq: number) => {
      setSaveStatus("saving");
      try {
        await invoke("save_settings", { settings: toSave });
        // Only clear errors if this is still the latest save request
        if (sequenceRef.current === seq) {
          setShortcutErrors({});
          setSaveStatus("saved");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Failed to save settings:", err);
        // Only apply error states if this request is still the latest
        if (sequenceRef.current === seq) {
          setError("設定の保存に失敗しました");
          setSaveStatus("error");
          parseAndSetErrors(msg);
        }
      }
    },
    [parseAndSetErrors],
  );

  const flushPendingSettings = useCallback(async () => {
    if (pendingSaveRef.current) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const toSave = pendingSaveRef.current;
      pendingSaveRef.current = null;
      await commitSettings(toSave, sequenceRef.current);
    }
  }, [commitSettings]);

  // Handle unload and unmount flushes
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushPendingSettings();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      flushPendingSettings();
    };
  }, [flushPendingSettings]);

  const clearError = useCallback(() => {
    setError(null);
    if (saveStatus === "error") {
      setSaveStatus("idle");
    }
    setShortcutErrors({});
  }, [saveStatus]);

  useEffect(() => {
    if (saveStatusTimerRef.current) {
      clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = null;
    }

    if (saveStatus === "saved") {
      saveStatusTimerRef.current = setTimeout(() => {
        setSaveStatus("idle");
        saveStatusTimerRef.current = null;
      }, SAVE_SUCCESS_VISIBLE_MS);
    }

    return () => {
      if (saveStatusTimerRef.current) {
        clearTimeout(saveStatusTimerRef.current);
        saveStatusTimerRef.current = null;
      }
    };
  }, [saveStatus]);

  useEffect(() => {
    if (saveErrorTimerRef.current) {
      clearTimeout(saveErrorTimerRef.current);
      saveErrorTimerRef.current = null;
    }

    if (saveStatus === "error") {
      saveErrorTimerRef.current = setTimeout(() => {
        setSaveStatus("idle");
        saveErrorTimerRef.current = null;
      }, SAVE_ERROR_VISIBLE_MS);
    }

    return () => {
      if (saveErrorTimerRef.current) {
        clearTimeout(saveErrorTimerRef.current);
        saveErrorTimerRef.current = null;
      }
    };
  }, [saveStatus]);

  const updateSettings = useCallback(
    (
      newSettings: Partial<AppSettings> | ((prev: AppSettings) => AppSettings),
    ) => {
      // 1. Calculate next state outside of the React state updater
      const prev = settingsRef.current;
      if (!prev) return;

      const updated =
        typeof newSettings === "function"
          ? newSettings(prev)
          : { ...prev, ...newSettings };

      // Avoid unnecessary saves if the settings haven't actually changed
      if (JSON.stringify(prev) === JSON.stringify(updated)) {
        return;
      }

      // 2. Determine if we need an immediate save
      const isImportant =
        prev.autostart !== updated.autostart ||
        prev.theme !== updated.theme ||
        prev.settingsShortcut !== updated.settingsShortcut ||
        prev.clock.enabled !== updated.clock.enabled ||
        prev.clock.shortcut !== updated.clock.shortcut ||
        prev.calendar.enabled !== updated.calendar.enabled ||
        prev.calendar.shortcut !== updated.calendar.shortcut ||
        prev.calendar.createEventShortcut !==
          updated.calendar.createEventShortcut ||
        prev.voiceToText.enabled !== updated.voiceToText.enabled ||
        prev.voiceToText.shortcut !== updated.voiceToText.shortcut;

      // 3. Update local state and refs synchronously
      settingsRef.current = updated;
      setSettings(updated);
      if (saveStatus === "error") {
        setError(null);
        setSaveStatus("idle");
      }

      // 4. Increment sequence ID for race condition protection
      sequenceRef.current += 1;
      const currentSeq = sequenceRef.current;

      // 5. Handle Side-Effects
      pendingSaveRef.current = updated;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (isImportant) {
        // Immediate save
        const toSave = pendingSaveRef.current;
        pendingSaveRef.current = null;
        commitSettings(toSave, currentSeq);
      } else {
        // Debounce save
        setSaveStatus("pending");
        timerRef.current = setTimeout(() => {
          if (!pendingSaveRef.current) return;
          const toSave = pendingSaveRef.current;
          pendingSaveRef.current = null;
          commitSettings(toSave, currentSeq);
        }, SAVE_DEBOUNCE_MS);
      }
    },
    [commitSettings, saveStatus],
  );

  return (
    <AppSettingsContext.Provider
      value={{
        settings,
        loading,
        error,
        saveStatus,
        shortcutErrors,
        clearError,
        reloadSettings,
        updateSettings,
      }}
    >
      {children}
    </AppSettingsContext.Provider>
  );
};

export const useAppSettings = () => {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error(
      "useAppSettings must be used within an AppSettingsProvider",
    );
  }
  return context;
};
