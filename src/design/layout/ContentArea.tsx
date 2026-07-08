import type React from "react";

interface ContentAreaProps {
  children: React.ReactNode;
}

export const ContentArea: React.FC<ContentAreaProps> = ({ children }) => {
  return <main className="app-content">{children}</main>;
};
