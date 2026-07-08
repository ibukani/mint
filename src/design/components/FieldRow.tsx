import type React from "react";

interface FieldRowProps {
  children: React.ReactNode;
}

export const FieldRow: React.FC<FieldRowProps> = ({ children }) => {
  return <div className="design-row">{children}</div>;
};
