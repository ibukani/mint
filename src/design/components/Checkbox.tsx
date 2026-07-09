import type React from "react";

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Checkbox: React.FC<CheckboxProps> = ({ className, ...props }) => {
  const { "aria-invalid": ariaInvalid, ...restProps } = props;
  const classes = ["design-checkbox", className].filter(Boolean).join(" ");

  return (
    <input
      type="checkbox"
      className={classes}
      aria-invalid={ariaInvalid}
      {...restProps}
    />
  );
};
