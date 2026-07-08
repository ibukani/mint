import { invoke } from "@tauri-apps/api/core";
import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ClockSettings } from "../../features/clock/types";
import type { VoiceToTextSettings } from "../../features/v2t/types";

export interface AppSettings {
  theme: "dark" | "light";
  clock: ClockSettings;
  voiceToText: VoiceToTextSettings;
}

interface AppSettingsContextType {
  settings: AppSettings | null;
  loading: boolean;
  error: string | null;
  shortcutErrors: Record<string, string>;
  clearError: () => void;
  updateSettings: (
    newSettings: Partial<AppSettings> | ((prev: AppSettings) => AppSettings),
  ) => void;
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(
  undefined,
);

const SAVE_DEBOUNCE_MS = 500;

export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shortcutErrors, setShortcutErrors] = useState<Record<string, string>>(
    {},
  );

  // Reference to the latest requested settings state
  const settingsRef = useRef<AppSettings | null>(null);
  const pendingSaveRef = useRef<AppSettings | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequenceRef = useRef<number>(0);

  useEffect(() => {
    async function load() {
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
    }
    load();
  }, []);

  const parseAndSetErrors = useCallback((errorMessage: string) => {
    const newErrors: Record<string, string> = {};
    if (errorMessage.includes("重複")) {
      newErrors.clock = "ショートカットキーが重複しています";
      newErrors.voiceToText = "ショートカットキーが重複しています";
    } else if (errorMessage.includes("時計")) {
      newErrors.clock = errorMessage;
    } else if (errorMessage.includes("音声入力")) {
      newErrors.voiceToText = errorMessage;
    }
    setShortcutErrors(newErrors);
  }, []);

  const commitSettings = useCallback(
    async (toSave: AppSettings, seq: number) => {
      try {
        await invoke("save_settings", { settings: toSave });
        // Only clear errors if this is still the latest save request
        if (sequenceRef.current === seq) {
          setShortcutErrors({});
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Failed to save settings:", err);
        // Only apply error states if this request is still the latest
        if (sequenceRef.current === seq) {
          setError("設定の保存に失敗しました");
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
    setShortcutErrors({});
  }, []);

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

      // 2. Determine if we need an immediate save
      const isImportant =
        prev.theme !== updated.theme ||
        prev.clock.shortcut !== updated.clock.shortcut ||
        prev.voiceToText.shortcut !== updated.voiceToText.shortcut;

      // 3. Update local state and refs synchronously
      settingsRef.current = updated;
      setSettings(updated);

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
        timerRef.current = setTimeout(() => {
          if (!pendingSaveRef.current) return;
          const toSave = pendingSaveRef.current;
          pendingSaveRef.current = null;
          commitSettings(toSave, currentSeq);
        }, SAVE_DEBOUNCE_MS);
      }
    },
    [commitSettings],
  );

  return (
    <AppSettingsContext.Provider
      value={{
        settings,
        loading,
        error,
        shortcutErrors,
        clearError,
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
