import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { AppSettings, SaveStatus, SettingsUpdate } from "../settingsModel";
import { SettingsStore, type SettingsStoreState } from "../store/settingsStore";

export type { AppSettings, SaveStatus } from "../settingsModel";
export type { SettingsStoreState };

const SettingsStoreContext = createContext<SettingsStore | null>(null);

export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [store] = useState(() => new SettingsStore());
  useEffect(() => {
    void store.attach();
    return () => store.detach();
  }, [store]);

  return (
    <SettingsStoreContext.Provider value={store}>
      {children}
    </SettingsStoreContext.Provider>
  );
};

export const useSettingsStore = (): SettingsStore => {
  const store = useContext(SettingsStoreContext);
  if (!store) {
    throw new Error(
      "useSettingsStore must be used within an AppSettingsProvider",
    );
  }
  return store;
};

/**
 * Selectively subscribes to a slice of the settings store.
 *
 * The selector result is memoized with `equalityFn` (default `Object.is`) so
 * subscribers only re-render when the selected value actually changes. Selectors
 * should return stable references (existing slices / primitives) instead of
 * building new objects or arrays on every call.
 */
export function useSettingsSelector<T>(
  selector: (state: SettingsStoreState) => T,
  equalityFn: (a: T, b: T) => boolean = Object.is,
): T {
  const store = useSettingsStore();
  const lastValueRef = useRef<T | undefined>(undefined);
  const hasValueRef = useRef(false);

  const getSnapshot = useCallback((): T => {
    const next = selector(store.getSnapshot());
    if (hasValueRef.current && equalityFn(lastValueRef.current as T, next)) {
      return lastValueRef.current as T;
    }
    lastValueRef.current = next;
    hasValueRef.current = true;
    return next;
  }, [store, selector, equalityFn]);

  const subscribe = useCallback(
    (listener: () => void) => store.subscribe(listener),
    [store],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// Module-level stable selectors keep `getSnapshot` identity stable across
// renders so `useSyncExternalStore` does no extra reconciliation work.
const selectSettings = (state: SettingsStoreState) => state.settings;
const selectLoading = (state: SettingsStoreState) => state.loading;
const selectError = (state: SettingsStoreState) => state.error;
const selectSaveStatus = (state: SettingsStoreState) => state.saveStatus;
const selectShortcutError =
  (featureKey: string) => (state: SettingsStoreState) =>
    state.shortcutErrors[featureKey] ?? "";

export function useSettings(): AppSettings | null {
  return useSettingsSelector(selectSettings);
}

export function useSettingsLoading(): boolean {
  return useSettingsSelector(selectLoading);
}

export function useSettingsError(): string | null {
  return useSettingsSelector(selectError);
}

export function useSettingsSaveStatus(): SaveStatus {
  return useSettingsSelector(selectSaveStatus);
}

export function useShortcutError(featureKey: string): string {
  const selectError = useMemo(
    () => selectShortcutError(featureKey),
    [featureKey],
  );
  return useSettingsSelector(selectError);
}

export function useUpdateSettings(): (update: SettingsUpdate) => void {
  return useSettingsStore().updateSettings;
}

export function useReloadSettings(): () => Promise<void> {
  return useSettingsStore().reload;
}

export function useRetrySaveSettings(): () => Promise<void> {
  return useSettingsStore().retrySave;
}

export function useClearError(): () => void {
  return useSettingsStore().clearError;
}
