import { useCallback, useEffect, useRef, useState } from "react";
import { getGameSourceStatus } from "../api";
import type { GameSourceStatus, GameStore } from "../types";

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

export const useGameSourceStatus = () => {
  const [state, setState] = useState<GameSourceStatusState>({
    phase: "loading",
    sources: [],
    gameCounts: createEmptyGameCounts(),
    error: null,
  });
  const sequenceRef = useRef(0);

  const scan = useCallback(async (force = false) => {
    const sequence = ++sequenceRef.current;
    setState((previous) => ({
      ...previous,
      phase: "loading",
      error: null,
    }));

    try {
      const result = await getGameSourceStatus(force);
      if (sequence !== sequenceRef.current) return;
      setState({
        phase: "ready",
        sources: result.sources,
        gameCounts: result.gameCounts,
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
