import type React from "react";

export type StatusBadgeTone =
  | "available"
  | "enabled"
  | "disabled"
  | "error"
  | "info";

interface StatusBadgeProps {
  children: React.ReactNode;
  tone: StatusBadgeTone;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ children, tone }) => {
  return (
    <span
      className={`design-status-badge design-status-badge--${tone}`}
      aria-live="polite"
      aria-atomic="true"
    >
      {children}
    </span>
  );
};
