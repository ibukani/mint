import type React from "react";

interface OverlayFrameProps {
  children: React.ReactNode;
}

export const OverlayFrame: React.FC<OverlayFrameProps> = ({ children }) => {
  return <div className="overlay-frame">{children}</div>;
};
