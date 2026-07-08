import type React from "react";
import { ClockOverlay } from "../features/clock/components/ClockOverlay";

export const WINDOW_ROUTES: Record<string, React.FC> = {
  clock: ClockOverlay,
};
