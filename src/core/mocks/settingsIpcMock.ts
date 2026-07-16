import type { MockIPCArgs, MockIPCResult } from "./ipcMockTypes";
import { handled, unhandled } from "./ipcMockTypes";

export interface SettingsIpcMockOptions {
  load: () => unknown | Promise<unknown>;
  save?: (settings: unknown) => unknown | Promise<unknown>;
  enabledTargets: Record<string, boolean>;
  onOpenOverlay?: (target: string) => unknown | Promise<unknown>;
}

export async function handleSettingsIpcCommand(
  command: string,
  args: MockIPCArgs,
  options: SettingsIpcMockOptions,
): Promise<MockIPCResult> {
  switch (command) {
    case "load_settings":
      return handled(await options.load());
    case "save_settings":
      return handled(await options.save?.(args?.settings));
    case "open_overlay": {
      const target = args?.target as string | undefined;
      if (!target || !(target in options.enabledTargets)) {
        throw new Error("利用できないオーバーレイです。");
      }
      if (!options.enabledTargets[target]) {
        throw new Error("このオーバーレイは無効になっています。");
      }
      return handled(await options.onOpenOverlay?.(target));
    }
    default:
      return unhandled();
  }
}
