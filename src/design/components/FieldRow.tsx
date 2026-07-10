import type React from "react";
import { Children, cloneElement, isValidElement } from "react";

interface FieldRowProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const FieldRow: React.FC<FieldRowProps> = ({
  children,
  className,
  "aria-describedby": describedBy,
  ...props
}) => {
  let describedControlFound = false;
  const enhancedChildren = Children.map(children, (child) => {
    if (!describedBy || describedControlFound || !isValidElement(child)) {
      return child;
    }

    const childProps = child.props as Record<string, unknown>;
    const isFormControl =
      "value" in childProps ||
      "checked" in childProps ||
      childProps.type === "text" ||
      childProps.type === "password";

    if (!isFormControl) return child;

    describedControlFound = true;
    const existing =
      typeof childProps["aria-describedby"] === "string"
        ? childProps["aria-describedby"]
        : undefined;
    const control = child as React.ReactElement<Record<string, unknown>>;
    return cloneElement(control, {
      "aria-describedby": [existing, describedBy].filter(Boolean).join(" "),
    });
  });

  return (
    <div
      className={className ? `design-row ${className}` : "design-row"}
      {...props}
    >
      {enhancedChildren}
    </div>
  );
};
