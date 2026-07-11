import type React from "react";
import { lazy } from "react";

const ClockOverlay = lazy(() =>
  import("../features/clock/components/ClockOverlay").then((m) => ({
    default: m.ClockOverlay,
  })),
);

const CalendarOverlay = lazy(() =>
  import("../features/calendar/components/CalendarOverlay").then((m) => ({
    default: m.CalendarOverlay,
  })),
);

const GameLauncherOverlay = lazy(() =>
  import("../features/game_launcher/components/GameLauncherOverlay").then(
    (m) => ({
      default: m.GameLauncherOverlay,
    }),
  ),
);

export const WINDOW_ROUTES: Record<
  string,
  React.LazyExoticComponent<React.FC>
> = {
  clock: ClockOverlay,
  calendar: CalendarOverlay,
  gameLauncher: GameLauncherOverlay,
};
