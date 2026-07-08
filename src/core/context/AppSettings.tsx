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
  const pendingRef = useRef<AppSettings | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const loaded = await invoke<AppSettings>("load_settings");
        setSettings(loaded);
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

  const flushPendingSettings = useCallback(async () => {
    if (pendingRef.current) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const toSave = pendingRef.current;
      pendingRef.current = null;
      try {
        await invoke("save_settings", { settings: toSave });
        setShortcutErrors({});
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Failed to flush settings:", err);
        setError("設定の保存に失敗しました");
        parseAndSetErrors(msg);
      }
    }
  }, [parseAndSetErrors]);

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
      setSettings((prev) => {
        if (!prev) return prev;
        const updated =
          typeof newSettings === "function"
            ? newSettings(prev)
            : { ...prev, ...newSettings };

        // 重要設定（ショートカットやテーマ変更など）が実際に変更されたか判定
        const isImportant =
          prev.theme !== updated.theme ||
          prev.clock.shortcut !== updated.clock.shortcut ||
          prev.voiceToText.shortcut !== updated.voiceToText.shortcut;

        pendingRef.current = updated;
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }

        if (isImportant) {
          // 即時保存
          const toSave = pendingRef.current;
          pendingRef.current = null;
          invoke("save_settings", { settings: toSave })
            .then(() => {
              setShortcutErrors({});
            })
            .catch((err) => {
              const msg = err instanceof Error ? err.message : String(err);
              console.error("Failed to save settings immediately:", err);
              setError("設定の保存に失敗しました");
              parseAndSetErrors(msg);
              setSettings(prev);
            });
        } else {
          // Debounce 保存
          timerRef.current = setTimeout(async () => {
            if (!pendingRef.current) return;
            const toSave = pendingRef.current;
            pendingRef.current = null;
            try {
              await invoke("save_settings", { settings: toSave });
              setShortcutErrors({});
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error("Failed to save settings:", err);
              setError("設定の保存に失敗しました");
              parseAndSetErrors(msg);
              setSettings(prev);
            }
          }, SAVE_DEBOUNCE_MS);
        }

        return updated;
      });
    },
    [parseAndSetErrors],
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
