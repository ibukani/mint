import { forwardRef, type InputHTMLAttributes } from "react";

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  controlSize?: "default" | "number";
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput(
    {
      className,
      controlSize = "default",
      invalid = false,
      type = "text",
      ...props
    },
    ref,
  ) {
    const classes = [
      type === "checkbox" ? "design-checkbox" : "design-control",
      controlSize === "number" ? "design-control--number" : "",
      invalid ? "is-invalid" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <input
        ref={ref}
        type={type}
        className={classes}
        aria-invalid={invalid}
        {...props}
      />
    );
  },
);
