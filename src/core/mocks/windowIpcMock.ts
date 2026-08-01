import type { MockIPCArgs, MockIPCResult } from "./ipcMockTypes";
import { handled, unhandled } from "./ipcMockTypes";

export interface WindowIpcMockOptions {
  onOverlayReady?: () => unknown | Promise<unknown>;
  onResetWindowState?: (label: unknown) => unknown | Promise<unknown>;
}

export async function handleWindowIpcCommand(
  command: string,
  args: MockIPCArgs,
  options: WindowIpcMockOptions = {},
): Promise<MockIPCResult> {
  if (command === "overlay_ready") {
    return handled(await options.onOverlayReady?.());
  }
  if (command === "reset_window_state") {
    return handled(await options.onResetWindowState?.(args?.label));
  }
  return unhandled();
}
