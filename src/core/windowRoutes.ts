import type React from "react";
import { lazy } from "react";
import { defaultAppSettings } from "./defaultSettings";
import type { AppSettings } from "./settingsModel";

interface WindowRouteDefinition {
  component: React.LazyExoticComponent<React.FC>;
  getThemeColor: (settings: AppSettings) => string;
}

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

const QuickCaptureOverlay = lazy(() =>
  import("../features/quick_capture/components/QuickCaptureOverlay").then(
    (m) => ({ default: m.QuickCaptureOverlay }),
  ),
);

const FileShelfOverlay = lazy(() =>
  import("../features/file_shelf/components/FileShelfOverlay").then((m) => ({
    default: m.FileShelfOverlay,
  })),
);

const CalendarEditorOverlay = lazy(() =>
  import("../features/calendar/components/CalendarEditorOverlay").then((m) => ({
    default: m.CalendarEditorOverlay,
  })),
);

export const WINDOW_ROUTES = {
  clock: {
    component: ClockOverlay,
    getThemeColor: (settings) => settings.clock.themeColor,
  },
  calendar: {
    component: CalendarOverlay,
    getThemeColor: (settings) => settings.calendar.themeColor,
  },
  calendarEditor: {
    component: CalendarEditorOverlay,
    getThemeColor: (settings) => settings.calendar.themeColor,
  },
  gameLauncher: {
    component: GameLauncherOverlay,
    getThemeColor: (settings) => settings.gameLauncher.themeColor,
  },
  quickCapture: {
    component: QuickCaptureOverlay,
    getThemeColor: (settings) => settings.quickCapture.themeColor,
  },
  fileShelf: {
    component: FileShelfOverlay,
    getThemeColor: (settings) => settings.fileShelf.themeColor,
  },
} satisfies Record<string, WindowRouteDefinition>;

export type WindowRouteLabel = keyof typeof WINDOW_ROUTES;

export const isWindowRouteLabel = (
  label: string | null,
): label is WindowRouteLabel => label !== null && label in WINDOW_ROUTES;

export const getWindowThemeColor = (
  label: WindowRouteLabel,
  settings: AppSettings | null,
) => {
  const route = WINDOW_ROUTES[label];
  return (
    route.getThemeColor(settings ?? defaultAppSettings) ||
    route.getThemeColor(defaultAppSettings)
  );
};
