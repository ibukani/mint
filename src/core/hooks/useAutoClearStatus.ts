import { useEffect } from "react";
import { useTimeoutTask } from "./useTimeoutTask";

export function useAutoClearStatus<T extends string>(
  status: T,
  clearStatus: () => void,
  resolveDelayMs: (status: T) => number | null,
  paused = false,
) {
  const { clearTimeoutTask, scheduleTimeoutTask } = useTimeoutTask();

  useEffect(() => {
    clearTimeoutTask();

    if (!status || paused) return undefined;

    const delayMs = resolveDelayMs(status);
    if (delayMs === null) return undefined;

    scheduleTimeoutTask(() => {
      clearStatus();
    }, delayMs);

    return clearTimeoutTask;
  }, [
    clearTimeoutTask,
    clearStatus,
    paused,
    resolveDelayMs,
    scheduleTimeoutTask,
    status,
  ]);
}
