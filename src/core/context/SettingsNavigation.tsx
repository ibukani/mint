import type React from "react";
import { createContext, useContext } from "react";
import type { SettingsTabId } from "../navigation/settingsTabs";

interface SettingsNavigationContextType {
  activeTab: SettingsTabId;
  setActiveTab: (tabId: SettingsTabId) => void;
}

const SettingsNavigationContext = createContext<
  SettingsNavigationContextType | undefined
>(undefined);

interface SettingsNavigationProviderProps {
  activeTab: SettingsTabId;
  setActiveTab: (tabId: SettingsTabId) => void;
  children: React.ReactNode;
}

export const SettingsNavigationProvider: React.FC<
  SettingsNavigationProviderProps
> = ({ activeTab, setActiveTab, children }) => {
  return (
    <SettingsNavigationContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </SettingsNavigationContext.Provider>
  );
};

export const useSettingsNavigation = () => {
  const context = useContext(SettingsNavigationContext);
  if (!context) {
    throw new Error(
      "useSettingsNavigation must be used within a SettingsNavigationProvider",
    );
  }
  return context;
};
