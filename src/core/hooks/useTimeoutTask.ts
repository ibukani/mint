import { useCallback, useEffect, useRef } from "react";

export function useTimeoutTask() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimeoutTask = useCallback(() => {
    if (!timerRef.current) return;

    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const scheduleTimeoutTask = useCallback(
    (task: () => void, delayMs: number) => {
      clearTimeoutTask();
      timerRef.current = setTimeout(() => {
        task();
        timerRef.current = null;
      }, delayMs);
    },
    [clearTimeoutTask],
  );

  useEffect(() => clearTimeoutTask, [clearTimeoutTask]);

  return { clearTimeoutTask, scheduleTimeoutTask };
}
