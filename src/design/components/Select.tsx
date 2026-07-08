import type React from "react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  className,
  invalid = false,
  ...props
}) => {
  const classes = ["design-control", invalid ? "is-invalid" : "", className]
    .filter(Boolean)
    .join(" ");

  return <select className={classes} aria-invalid={invalid} {...props} />;
};
