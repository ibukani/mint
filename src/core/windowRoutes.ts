import type React from "react";
import { lazy } from "react";

const ClockOverlay = lazy(() =>
  import("../features/clock/components/ClockOverlay").then((m) => ({
    default: m.ClockOverlay,
  })),
);

export const WINDOW_ROUTES: Record<
  string,
  React.LazyExoticComponent<React.FC>
> = {
  clock: ClockOverlay,
};
