import type { MockIPCArgs, MockIPCResult } from "./ipcMockTypes";
import { handled, unhandled } from "./ipcMockTypes";

export interface WindowIpcMockOptions {
  onOverlayReady?: () => unknown | Promise<unknown>;
  onResetWindowState?: (label: unknown) => unknown | Promise<unknown>;
  onOpenSettingsTab?: (args: {
    tab: unknown;
    targetId?: unknown;
  }) => unknown | Promise<unknown>;
  onTakePendingSettingsTab?: () => unknown | Promise<unknown>;
  onOpenV2tWithAudioFile?: (path: unknown) => unknown | Promise<unknown>;
  onTakePendingV2tAudioFile?: () => unknown | Promise<unknown>;
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
  if (command === "open_settings_tab") {
    return handled(
      await options.onOpenSettingsTab?.({
        tab: args?.tab,
        targetId: args?.targetId,
      }),
    );
  }
  if (command === "take_pending_settings_tab") {
    return handled(await options.onTakePendingSettingsTab?.());
  }
  if (command === "open_v2t_with_audio_file") {
    return handled(await options.onOpenV2tWithAudioFile?.(args?.path));
  }
  if (command === "take_pending_v2t_audio_file") {
    return handled(await options.onTakePendingV2tAudioFile?.());
  }
  return unhandled();
}
