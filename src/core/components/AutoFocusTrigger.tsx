import type React from "react";
import { useEffect } from "react";

export const AutoFocusTrigger: React.FC = () => {
  useEffect(() => {
    const timer = setTimeout(() => {
      const content = document.querySelector(".app-content");
      const focusable = content?.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([type="checkbox"]):not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled])',
      );
      focusable?.focus();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  return null;
};
