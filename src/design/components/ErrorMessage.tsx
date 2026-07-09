import type React from "react";
import { useEffect, useRef } from "react";

interface ErrorMessageProps {
  children: React.ReactNode;
  autoFocus?: boolean;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  children,
  autoFocus = false,
}) => {
  const messageRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (autoFocus) {
      messageRef.current?.focus();
    }
  }, [autoFocus]);

  return (
    <p
      ref={messageRef}
      className="design-error-message"
      role="alert"
      tabIndex={autoFocus ? -1 : undefined}
    >
      {children}
    </p>
  );
};
