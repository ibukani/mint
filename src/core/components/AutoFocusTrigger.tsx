import type React from "react";
import { useEffect } from "react";
import { revealElementVertically } from "../../design/layout/scrollVisibility";

interface AutoFocusTriggerProps {
  enabled?: boolean;
  targetId?: string;
}

export const AutoFocusTrigger: React.FC<AutoFocusTriggerProps> = ({
  enabled = true,
  targetId,
}) => {
  useEffect(() => {
    if (!enabled) return undefined;

    const timer = setTimeout(() => {
      const content = document.querySelector<HTMLElement>(".app-content");
      const title = content?.querySelector<HTMLElement>(
        ".design-settings-section__title",
      );
      const requestedTarget = targetId
        ? document.getElementById(targetId)
        : null;
      const focusTarget = requestedTarget ?? title;

      if (content && requestedTarget) {
        revealElementVertically(content, requestedTarget, 24);
      } else if (content) {
        content.scrollTop = 0;
      }
      focusTarget?.focus({ preventScroll: true });
      if (
        requestedTarget instanceof HTMLInputElement ||
        requestedTarget instanceof HTMLTextAreaElement
      ) {
        requestedTarget.select();
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [enabled, targetId]);

  return null;
};
