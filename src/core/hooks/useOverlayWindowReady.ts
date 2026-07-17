import { useEffect } from "react";
import { notifyOverlayReady } from "../windowCommands";

/**
 * Tells the native side that an initially hidden overlay has mounted. The
 * native window stays hidden until this handshake completes, preventing the
 * app loading surface from flashing during first creation.
 */
export const useOverlayWindowReady = () => {
  useEffect(() => {
    void notifyOverlayReady()
      .then(() => undefined)
      .catch((error) => {
        console.warn("Failed to notify overlay readiness", error);
      });
  }, []);
};
