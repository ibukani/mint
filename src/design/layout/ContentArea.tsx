import type React from "react";

interface ContentAreaProps {
  children: React.ReactNode;
}

export const ContentArea: React.FC<ContentAreaProps> = ({ children }) => {
  return (
    <main id="main-content" className="app-content" tabIndex={-1}>
      {children}
    </main>
  );
};
