import type { GameScanResult } from "../../features/game_launcher/types";
import type { MockIPCArgs, MockIPCResult } from "./ipcMockTypes";
import { handled, unhandled } from "./ipcMockTypes";

interface GameRequest {
  id?: string;
}

export interface GameLauncherIpcMockOptions {
  scanResult: GameScanResult;
  onScan?: (force: boolean) => GameScanResult | Promise<GameScanResult>;
  onLaunch?: (id: string) => unknown | Promise<unknown>;
  onOpenStorePage?: (id: string) => unknown | Promise<unknown>;
}

export async function handleGameLauncherIpcCommand(
  command: string,
  args: MockIPCArgs,
  options: GameLauncherIpcMockOptions,
): Promise<MockIPCResult> {
  switch (command) {
    case "list_installed_games": {
      const result = options.onScan
        ? await options.onScan(Boolean(args?.force))
        : options.scanResult;
      return handled(result);
    }
    case "launch_game": {
      const request = args?.request as GameRequest | undefined;
      if (!request?.id) throw new Error("Game id is required.");
      return handled(await options.onLaunch?.(request.id));
    }
    case "open_game_store_page": {
      const request = args?.request as GameRequest | undefined;
      if (!request?.id) throw new Error("Game id is required.");
      return handled(await options.onOpenStorePage?.(request.id));
    }
    default:
      return unhandled();
  }
}
