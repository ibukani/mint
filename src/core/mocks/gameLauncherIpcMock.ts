import type {
  GameScanResult,
  GameSourceSummary,
  GameStore,
  LaunchGameRequest,
} from "../../features/game_launcher/types";
import type { MockIPCArgs, MockIPCResult } from "./ipcMockTypes";
import { handled, unhandled } from "./ipcMockTypes";

export interface GameLauncherIpcMockOptions {
  scanResult: GameScanResult;
  onScan?: (force: boolean) => GameScanResult | Promise<GameScanResult>;
  onSourceScan?: (
    force: boolean,
  ) => GameSourceSummary | Promise<GameSourceSummary>;
  onLaunch?: (request: LaunchGameRequest) => unknown | Promise<unknown>;
  onOpenStorePage?: (request: LaunchGameRequest) => unknown | Promise<unknown>;
}

const GAME_STORES = new Set<GameStore>(["steam", "epic", "riot"]);

const readGameRequest = (args: MockIPCArgs): LaunchGameRequest => {
  const request = args?.request as Partial<LaunchGameRequest> | undefined;
  if (!request?.id?.trim()) throw new Error("Game id is required.");
  if (!request.store || !GAME_STORES.has(request.store)) {
    throw new Error("Game store is required.");
  }
  return { id: request.id, store: request.store };
};

const summarizeSources = (result: GameScanResult): GameSourceSummary => {
  const gameCounts: Record<GameStore, number> = { steam: 0, epic: 0, riot: 0 };
  for (const game of result.games) gameCounts[game.store] += 1;
  return { sources: result.sources, gameCounts };
};

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
    case "get_game_source_status": {
      const result = options.onSourceScan
        ? await options.onSourceScan(Boolean(args?.force))
        : summarizeSources(options.scanResult);
      return handled(result);
    }
    case "launch_game": {
      const request = readGameRequest(args);
      return handled(await options.onLaunch?.(request));
    }
    case "open_game_store_page": {
      const request = readGameRequest(args);
      return handled(await options.onOpenStorePage?.(request));
    }
    default:
      return unhandled();
  }
}
