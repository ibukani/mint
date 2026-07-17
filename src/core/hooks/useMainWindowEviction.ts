import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import { useOverlayWindowEviction } from "./useOverlayWindowEviction";

export const useMainWindowEviction = (isMainWindow: boolean) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isMainWindow) return undefined;

    const currentWindow = getCurrentWindow();
    if (typeof currentWindow.isVisible === "function") {
      void currentWindow
        .isVisible()
        .then(setIsVisible)
        .catch(() => setIsVisible(true));
    } else {
      setIsVisible(true);
    }

    const shownPromise = listen("main-window-shown", () => {
      setIsVisible(true);
    });
    const closeRequested =
      typeof currentWindow.onCloseRequested === "function"
        ? currentWindow.onCloseRequested(() => setIsVisible(false))
        : null;

    return () => {
      void shownPromise.then((unlisten) => unlisten());
      if (closeRequested) {
        void closeRequested.then((unlisten) => unlisten());
      }
    };
  }, [isMainWindow]);

  useOverlayWindowEviction(isMainWindow && isVisible);
};
