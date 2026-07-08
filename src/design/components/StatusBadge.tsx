import type React from "react";

export type StatusBadgeTone = "available" | "enabled" | "disabled" | "error";

interface StatusBadgeProps {
  children: React.ReactNode;
  tone: StatusBadgeTone;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ children, tone }) => {
  return (
    <span className={`design-status-badge design-status-badge--${tone}`}>
      {children}
    </span>
  );
};
