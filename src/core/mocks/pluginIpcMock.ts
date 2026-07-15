import type { DownloadEvent } from "@tauri-apps/plugin-updater";
import type { MockIPCArgs, MockIPCResult } from "./ipcMockTypes";
import { handled, unhandled } from "./ipcMockTypes";

type DownloadChannel = { onmessage?: (event: DownloadEvent) => void };

export interface PluginIpcMockOptions {
  update: unknown;
  dialogOpen?: string | null;
  dialogSave: string;
  onDownloadAndInstall?: (
    channel: DownloadChannel | undefined,
  ) => unknown | Promise<unknown>;
  onRestart?: () => unknown | Promise<unknown>;
}

export async function handlePluginIpcCommand(
  command: string,
  args: MockIPCArgs,
  options: PluginIpcMockOptions,
): Promise<MockIPCResult> {
  switch (command) {
    case "plugin:updater|check":
      return handled(options.update);
    case "plugin:dialog|open":
      return handled(options.dialogOpen ?? null);
    case "plugin:dialog|save":
      return handled(options.dialogSave);
    case "plugin:updater|download_and_install": {
      const channel = args?.onEvent as DownloadChannel | undefined;
      return handled(await options.onDownloadAndInstall?.(channel));
    }
    case "plugin:process|restart":
      return handled(await options.onRestart?.());
    case "plugin:resources|close":
      return handled(undefined);
    default:
      return unhandled();
  }
}
