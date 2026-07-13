import { useCallback, useEffect, useState } from "react";
import type { StatusTone } from "../types";

export const useTransientStatus = (
  visibleMs: number | ((status: string) => number),
) => {
  const [status, setStatusValue] = useState("");
  const [tone, setTone] = useState<StatusTone>("success");

  const setStatus = useCallback(
    (nextStatus: string, nextTone: StatusTone = "success") => {
      setStatusValue(nextStatus);
      if (nextStatus) setTone(nextTone);
    },
    [],
  );

  useEffect(() => {
    if (!status) return undefined;
    const duration =
      typeof visibleMs === "function" ? visibleMs(status) : visibleMs;
    const timer = setTimeout(() => setStatus(""), duration);
    return () => clearTimeout(timer);
  }, [setStatus, status, visibleMs]);

  return [status, setStatus, tone] as const;
};
