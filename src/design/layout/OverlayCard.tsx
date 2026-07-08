import type React from "react";

interface OverlayCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const OverlayCard: React.FC<OverlayCardProps> = ({
  children,
  className,
  ...props
}) => {
  const classes = ["overlay-card", className].filter(Boolean).join(" ");

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
};
