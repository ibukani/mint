import type React from "react";
import { createContext, useContext } from "react";
import type { SettingsTabId } from "../navigation/settingsTabs";

interface SettingsNavigationContextType {
  activeTab: SettingsTabId;
  setActiveTab: (tabId: SettingsTabId) => void;
  requestOnboarding: () => void;
}

const noop = () => {};

const SettingsNavigationContext = createContext<SettingsNavigationContextType>({
  activeTab: "general",
  setActiveTab: noop,
  requestOnboarding: noop,
});

interface SettingsNavigationProviderProps {
  activeTab: SettingsTabId;
  setActiveTab: (tabId: SettingsTabId) => void;
  requestOnboarding?: () => void;
  children: React.ReactNode;
}

export const SettingsNavigationProvider: React.FC<
  SettingsNavigationProviderProps
> = ({ activeTab, setActiveTab, requestOnboarding = noop, children }) => {
  return (
    <SettingsNavigationContext.Provider
      value={{ activeTab, setActiveTab, requestOnboarding }}
    >
      {children}
    </SettingsNavigationContext.Provider>
  );
};

export const useSettingsNavigation = () => {
  return useContext(SettingsNavigationContext);
};
