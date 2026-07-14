import type React from "react";
import { forwardRef } from "react";

type ButtonVariant = "primary" | "ghost" | "danger";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", type = "button", ...props }, ref) => {
    const classes = ["design-button", `design-button--${variant}`, className]
      .filter(Boolean)
      .join(" ");

    return <button ref={ref} type={type} className={classes} {...props} />;
  },
);

Button.displayName = "Button";
