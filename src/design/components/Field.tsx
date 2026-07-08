import type React from "react";

interface FieldProps {
  id?: string;
  label?: React.ReactNode;
  helpText?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
  orientation?: "vertical" | "inline";
}

export const Field: React.FC<FieldProps> = ({
  id,
  label,
  helpText,
  error,
  children,
  orientation = "vertical",
}) => {
  const labelElement = label ? (
    <label className="design-field__label" htmlFor={id}>
      {label}
    </label>
  ) : null;

  return (
    <div className={`design-field design-field--${orientation}`}>
      {orientation === "inline" ? children : labelElement}
      {orientation === "inline" ? labelElement : children}
      {error && (
        <p
          className="design-field__error"
          id={id ? `${id}-error` : undefined}
          role="alert"
        >
          {error}
        </p>
      )}
      {helpText && (
        <span className="design-field__help" id={id ? `${id}-help` : undefined}>
          {helpText}
        </span>
      )}
    </div>
  );
};
