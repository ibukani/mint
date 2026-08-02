import { listen } from "@tauri-apps/api/event";
import {
  requiresImmediateSettingsSave,
  settingsAreEqual,
} from "../persistence/settingsChangePolicy";
import { parseShortcutErrors } from "../persistence/shortcutErrors";
import { loadSettings, saveSettings } from "../settings";
import type { AppSettings, SaveStatus, SettingsUpdate } from "../settingsModel";

const SAVE_DEBOUNCE_MS = 500;
const SAVE_SUCCESS_VISIBLE_MS = 2000;

export interface SettingsStoreState {
  settings: AppSettings | null;
  loading: boolean;
  error: string | null;
  saveStatus: SaveStatus;
  shortcutErrors: Readonly<Record<string, string>>;
}

const createInitialState = (): SettingsStoreState => ({
  settings: null,
  loading: true,
  error: null,
  saveStatus: "idle",
  shortcutErrors: {},
});

/**
 * External settings store for `useSyncExternalStore`-based selective
 * subscription. Owns the save queue, debounce, immediate-save policy,
 * sequence control, retry handling and the cross-window `settings-changed`
 * reconciliation that previously lived in `useAppSettingsController`.
 *
 * The store only ever swaps in new top-level state objects on actual changes,
 * so selectors that read unchanged slices keep stable references and React
 * subscribers do not re-render for unrelated updates.
 */
export class SettingsStore {
  private state: SettingsStoreState = createInitialState();
  private listeners = new Set<() => void>();
  private pendingSave: AppSettings | null = null;
  private failedSave: AppSettings | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private saveStatusTimer: ReturnType<typeof setTimeout> | null = null;
  private sequence = 0;
  private saveQueue: Promise<void> = Promise.resolve();
  private unlistenSettingsChanged: (() => void) | null = null;
  private disposed = false;

  getSnapshot = (): SettingsStoreState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private setState(patch: Partial<SettingsStoreState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  /** Sets saveStatus and manages the "saved" → "idle" reset timer. */
  private setSaveStatus(status: SaveStatus): void {
    if (this.saveStatusTimer) {
      clearTimeout(this.saveStatusTimer);
      this.saveStatusTimer = null;
    }
    this.setState({ saveStatus: status });
    if (status === "saved") {
      this.saveStatusTimer = setTimeout(() => {
        this.saveStatusTimer = null;
        if (this.state.saveStatus === "saved") {
          this.setState({ saveStatus: "idle" });
        }
      }, SAVE_SUCCESS_VISIBLE_MS);
    }
  }

  reload = async (): Promise<void> => {
    this.setState({ loading: true, error: null });
    try {
      const loaded = await loadSettings();
      this.setState({ settings: loaded });
    } catch (loadError) {
      console.error("Failed to load settings:", loadError);
      this.setState({ error: "設定の読み込みに失敗しました" });
    } finally {
      this.setState({ loading: false });
    }
  };

  updateSettings = (update: SettingsUpdate): void => {
    const previous = this.state.settings;
    if (!previous) return;

    const next =
      typeof update === "function"
        ? update(previous)
        : { ...previous, ...update };
    if (settingsAreEqual(previous, next)) return;

    const saveImmediately = requiresImmediateSettingsSave(previous, next);
    this.setState({ settings: next });
    if (this.state.saveStatus === "error") {
      this.setState({ error: null });
      this.setSaveStatus("idle");
    }

    this.sequence += 1;
    const sequence = this.sequence;
    this.failedSave = null;
    this.pendingSave = next;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (saveImmediately) {
      const settingsToSave = this.pendingSave;
      this.pendingSave = null;
      void this.commitSettings(settingsToSave, sequence);
      return;
    }

    this.setSaveStatus("pending");
    this.debounceTimer = setTimeout(() => {
      if (!this.pendingSave) return;
      const settingsToSave = this.pendingSave;
      this.pendingSave = null;
      void this.commitSettings(settingsToSave, sequence);
    }, SAVE_DEBOUNCE_MS);
  };

  retrySave = async (): Promise<void> => {
    const failedSettings = this.failedSave;
    if (!failedSettings) return;

    this.failedSave = null;
    this.setState({ error: null });
    this.sequence += 1;
    await this.commitSettings(failedSettings, this.sequence);
  };

  clearError = (): void => {
    this.setState({ error: null });
  };

  flushPendingSettings = async (): Promise<void> => {
    if (!this.pendingSave) return;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    const settingsToSave = this.pendingSave;
    this.pendingSave = null;
    await this.commitSettings(settingsToSave, this.sequence);
  };

  private commitSettings(
    settingsToSave: AppSettings,
    sequence: number,
  ): Promise<void> {
    const queuedSave = this.saveQueue
      .catch(() => undefined)
      .then(async () => {
        if (this.sequence === sequence) this.setSaveStatus("saving");
        try {
          await saveSettings(settingsToSave);
          if (this.sequence === sequence) {
            this.failedSave = null;
            this.setState({ error: null, shortcutErrors: {} });
            this.setSaveStatus("saved");
          }
        } catch (saveError) {
          const message =
            saveError instanceof Error ? saveError.message : String(saveError);
          console.error("Failed to save settings:", saveError);
          if (this.sequence === sequence) {
            const parsedShortcutErrors = parseShortcutErrors(message);
            this.failedSave = settingsToSave;
            this.setState({
              error:
                Object.keys(parsedShortcutErrors).length > 0
                  ? "ショートカットキーを確認してください。競合または登録できないキーがあります。"
                  : "設定の保存に失敗しました",
              shortcutErrors: parsedShortcutErrors,
            });
            this.setSaveStatus("error");
          }
        }
      });
    this.saveQueue = queuedSave;
    return queuedSave;
  }

  private handleBeforeUnload = (): void => {
    void this.flushPendingSettings();
  };

  private handleSettingsChanged = async (event: {
    payload?: AppSettings;
  }): Promise<void> => {
    const sequenceAtEvent = this.sequence;
    try {
      const loaded = event?.payload ?? (await loadSettings());
      if (this.sequence !== sequenceAtEvent || this.pendingSave !== null) {
        return;
      }
      if (!settingsAreEqual(this.state.settings, loaded)) {
        this.setState({ settings: loaded });
      }
    } catch (loadError) {
      console.error("Failed to reload settings:", loadError);
    }
  };

  /** Registers the cross-window listener, beforeunload flush and initial load. */
  async attach(): Promise<void> {
    this.disposed = false;
    window.addEventListener("beforeunload", this.handleBeforeUnload);
    void this.reload();
    const unlisten = await listen<AppSettings>(
      "settings-changed",
      this.handleSettingsChanged,
    );
    if (this.disposed) {
      unlisten();
      return;
    }
    this.unlistenSettingsChanged = unlisten;
  }

  /** Removes the event listener, flushes pending changes and clears timers. */
  detach(): void {
    this.disposed = true;
    this.unlistenSettingsChanged?.();
    this.unlistenSettingsChanged = null;
    window.removeEventListener("beforeunload", this.handleBeforeUnload);
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.saveStatusTimer) {
      clearTimeout(this.saveStatusTimer);
      this.saveStatusTimer = null;
    }
    void this.flushPendingSettings();
  }
}
