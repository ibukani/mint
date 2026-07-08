import type React from "react";

interface TextAreaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const TextArea: React.FC<TextAreaProps> = ({
  className,
  invalid = false,
  ...props
}) => {
  const classes = ["design-control", invalid ? "is-invalid" : "", className]
    .filter(Boolean)
    .join(" ");

  return <textarea className={classes} aria-invalid={invalid} {...props} />;
};
