import type React from "react";

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  controlSize?: "default" | "number";
}

export const TextInput: React.FC<TextInputProps> = ({
  className,
  controlSize = "default",
  invalid = false,
  type = "text",
  ...props
}) => {
  const classes = [
    type === "checkbox" ? "design-checkbox" : "design-control",
    controlSize === "number" ? "design-control--number" : "",
    invalid ? "is-invalid" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <input type={type} className={classes} aria-invalid={invalid} {...props} />
  );
};
