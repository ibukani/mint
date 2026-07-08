import type React from "react";

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({
  children,
  className,
  ...props
}) => {
  const classes = ["design-panel", className].filter(Boolean).join(" ");

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
};
