import type React from "react";
import { useWindowDrag } from "./useWindowDrag";

interface OverlayCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const OverlayCard: React.FC<OverlayCardProps> = ({
  children,
  className,
  ...props
}) => {
  const classes = ["overlay-card", className].filter(Boolean).join(" ");
  const windowDragHandlers = useWindowDrag();

  return (
    <div className={classes} {...windowDragHandlers} {...props}>
      {children}
    </div>
  );
};
