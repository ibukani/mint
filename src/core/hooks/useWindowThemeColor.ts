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
      root.style.removeProperty("--window-accent-color");
      return undefined;
    }

    const color = getWindowThemeColor(label, settings);
    if (color) root.style.setProperty("--window-accent-color", color);
    else root.style.removeProperty("--window-accent-color");

    return () => {
      root.style.removeProperty("--window-accent-color");
    };
  }, [label, settings]);
};
