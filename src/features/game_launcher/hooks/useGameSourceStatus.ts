import { useCallback, useEffect, useRef, useState } from "react";
import { listInstalledGames } from "../api";
import type { GameScanResult, GameSourceStatus, GameStore } from "../types";

export type GameSourceScanPhase = "loading" | "ready" | "error";

interface GameSourceStatusState {
  phase: GameSourceScanPhase;
  sources: GameSourceStatus[];
  gameCounts: Record<GameStore, number>;
  error: string | null;
}

const createEmptyGameCounts = (): Record<GameStore, number> => ({
  steam: 0,
  epic: 0,
  riot: 0,
});

const countGamesByStore = (
  result: GameScanResult,
): Record<GameStore, number> => {
  const counts = createEmptyGameCounts();
  for (const game of result.games) {
    counts[game.store] += 1;
  }
  return counts;
};

export const useGameSourceStatus = () => {
  const [state, setState] = useState<GameSourceStatusState>({
    phase: "loading",
    sources: [],
    gameCounts: createEmptyGameCounts(),
    error: null,
  });
  const sequenceRef = useRef(0);

  const scan = useCallback(async () => {
    const sequence = ++sequenceRef.current;
    setState((previous) => ({
      ...previous,
      phase: "loading",
      error: null,
    }));

    try {
      const result = await listInstalledGames();
      if (sequence !== sequenceRef.current) return;
      setState({
        phase: "ready",
        sources: result.sources,
        gameCounts: countGamesByStore(result),
        error: null,
      });
    } catch (reason) {
      if (sequence !== sequenceRef.current) return;
      setState((previous) => ({
        ...previous,
        phase: "error",
        error: reason instanceof Error ? reason.message : String(reason),
      }));
    }
  }, []);

  useEffect(() => {
    void scan();
    return () => {
      sequenceRef.current += 1;
    };
  }, [scan]);

  return { ...state, scan };
};
