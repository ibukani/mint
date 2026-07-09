import { useEffect, useRef } from "react";

export function useAutoClearStatus(
  status: string,
  clearStatus: () => void,
  resolveDelayMs: (status: string) => number | null,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!status) return undefined;

    const delayMs = resolveDelayMs(status);
    if (delayMs === null) return undefined;

    timerRef.current = setTimeout(() => {
      clearStatus();
      timerRef.current = null;
    }, delayMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [clearStatus, resolveDelayMs, status]);
}
