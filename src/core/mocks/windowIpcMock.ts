import type { MockIPCArgs, MockIPCResult } from "./ipcMockTypes";
import { handled, unhandled } from "./ipcMockTypes";

export interface WindowIpcMockOptions {
  onOverlayReady?: () => unknown | Promise<unknown>;
}

export async function handleWindowIpcCommand(
  command: string,
  _args: MockIPCArgs,
  options: WindowIpcMockOptions = {},
): Promise<MockIPCResult> {
  if (command !== "overlay_ready") return unhandled();
  return handled(await options.onOverlayReady?.());
}
