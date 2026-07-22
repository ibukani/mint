import { useLayoutEffect } from "react";
import type { AppSettings } from "../settingsModel";
import { getWindowThemeColor, isWindowRouteLabel } from "../windowRoutes";

export const useWindowThemeColor = (
  label: string | null,
  settings: AppSettings | null,
) => {
  useLayoutEffect(() => {
    const root = document.documentElement;

    if (!isWindowRouteLabel(label)) {
      root.style.removeProperty("--color-accent");
      return undefined;
    }

    root.style.setProperty(
      "--color-accent",
      getWindowThemeColor(label, settings),
    );

    return () => {
      root.style.removeProperty("--color-accent");
    };
  }, [label, settings]);
};
