import type React from "react";
import { useEffect } from "react";

interface ErrorToastProps {
  message: string | null;
  onDismiss: () => void;
}

export const ErrorToast: React.FC<ErrorToastProps> = ({
  message,
  onDismiss,
}) => {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(onDismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className="error-toast">
      <span className="error-toast-message">{message}</span>
      <button type="button" className="error-toast-close" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
};
