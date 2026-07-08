import type React from "react";

interface ErrorMessageProps {
  children: React.ReactNode;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ children }) => {
  return (
    <p className="design-error-message" role="alert">
      {children}
    </p>
  );
};
