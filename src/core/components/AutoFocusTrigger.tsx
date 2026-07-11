import type React from "react";
import { useEffect } from "react";

export const AutoFocusTrigger: React.FC = () => {
  useEffect(() => {
    const timer = setTimeout(() => {
      const content = document.querySelector<HTMLElement>(".app-content");
      const title = content?.querySelector<HTMLElement>(
        ".design-settings-section__title",
      );

      if (content) content.scrollTop = 0;
      title?.focus({ preventScroll: true });
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  return null;
};
