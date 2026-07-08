import type React from "react";

interface UnitLabelProps {
  children: React.ReactNode;
}

export const UnitLabel: React.FC<UnitLabelProps> = ({ children }) => {
  return <span className="design-unit-label">{children}</span>;
};
