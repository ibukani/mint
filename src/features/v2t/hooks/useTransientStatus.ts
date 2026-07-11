import { useEffect, useState } from "react";

export const useTransientStatus = (
  visibleMs: number | ((status: string) => number),
) => {
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!status) return undefined;
    const duration =
      typeof visibleMs === "function" ? visibleMs(status) : visibleMs;
    const timer = setTimeout(() => setStatus(""), duration);
    return () => clearTimeout(timer);
  }, [status, visibleMs]);

  return [status, setStatus] as const;
};
