import type React from "react";

type ButtonVariant = "primary" | "ghost";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button: React.FC<ButtonProps> = ({
  className,
  variant = "primary",
  type = "button",
  ...props
}) => {
  const classes = ["design-button", `design-button--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return <button type={type} className={classes} {...props} />;
};
