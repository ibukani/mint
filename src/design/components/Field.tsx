import type React from "react";
import { cloneElement, isValidElement } from "react";

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
  const helpId = id ? `${id}-help` : undefined;
  const errorId = id ? `${id}-error` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(" ") || undefined;
  const fieldChildren =
    isValidElement(children) && describedBy
      ? (() => {
          const element = children as React.ReactElement<
            Record<string, unknown>
          >;
          return cloneElement(element, {
            "aria-describedby": [
              element.props["aria-describedby"] as string | undefined,
              describedBy,
            ]
              .filter(Boolean)
              .join(" "),
          });
        })()
      : children;

  return (
    <div className={`design-field design-field--${orientation}`}>
      {orientation === "inline" ? fieldChildren : labelElement}
      {orientation === "inline" ? labelElement : fieldChildren}
      {error && (
        <p className="design-field__error" id={errorId} role="alert">
          {error}
        </p>
      )}
      {helpText && (
        <span className="design-field__help" id={helpId}>
          {helpText}
        </span>
      )}
    </div>
  );
};
