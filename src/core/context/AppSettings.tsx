import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ClockSettings } from "../../features/clock/types";
import { VoiceToTextSettings } from "../../features/v2t/types";

export interface AppSettings {
  theme: "dark" | "light";
  clock: ClockSettings;
  voiceToText: VoiceToTextSettings;
}

interface AppSettingsContextType {
  settings: AppSettings | null;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  updateSettings: (newSettings: Partial<AppSettings> | ((prev: AppSettings) => AppSettings)) => void;
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

const SAVE_DEBOUNCE_MS = 500;

export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const updateSettings = useCallback(
    (newSettings: Partial<AppSettings> | ((prev: AppSettings) => AppSettings)) => {
      setSettings((prev) => {
        if (!prev) return prev;
        const updated =
          typeof newSettings === "function" ? newSettings(prev) : { ...prev, ...newSettings };

        // Queue debounced save
        pendingRef.current = updated;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(async () => {
          if (!pendingRef.current) return;
          try {
            await invoke("save_settings", { settings: pendingRef.current });
          } catch (err) {
            console.error("Failed to save settings:", err);
            setError("設定の保存に失敗しました");
          }
          pendingRef.current = null;
        }, SAVE_DEBOUNCE_MS);

        return updated;
      });
    },
    [],
  );

  return (
    <AppSettingsContext.Provider value={{ settings, loading, error, clearError, updateSettings }}>
      {children}
    </AppSettingsContext.Provider>
  );
};

export const useAppSettings = () => {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error("useAppSettings must be used within an AppSettingsProvider");
  }
  return context;
};
