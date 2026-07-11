import type React from "react";
import { createContext, useContext } from "react";
import { useAppSettingsController } from "../hooks/useAppSettingsController";
import type { AppSettings, SaveStatus, SettingsUpdate } from "../settingsModel";

export type { AppSettings, SaveStatus } from "../settingsModel";

interface AppSettingsContextType {
  settings: AppSettings | null;
  loading: boolean;
  error: string | null;
  saveStatus: SaveStatus;
  shortcutErrors: Record<string, string>;
  clearError: () => void;
  reloadSettings: () => Promise<void>;
  retrySaveSettings: () => Promise<void>;
  updateSettings: (update: SettingsUpdate) => void;
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(
  undefined,
);

export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const controller = useAppSettingsController();

  return (
    <AppSettingsContext.Provider value={controller}>
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
