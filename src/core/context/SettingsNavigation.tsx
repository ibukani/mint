import type React from "react";
import { createContext, useContext } from "react";
import type { SettingsTabId } from "../navigation/settingsTabs";

interface SettingsNavigationContextType {
  activeTab: SettingsTabId;
  setActiveTab: (tabId: SettingsTabId) => void;
}

const noop = () => {};

const SettingsNavigationContext = createContext<SettingsNavigationContextType>({
  activeTab: "dashboard",
  setActiveTab: noop,
});

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
  return useContext(SettingsNavigationContext);
};
