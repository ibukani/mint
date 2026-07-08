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

  useEffect(() => {
    if (!message) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDismiss();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className="error-toast" role="alert">
      <span className="error-toast-message">{message}</span>
      <button
        type="button"
        className="error-toast-close"
        aria-label="エラー通知を閉じる"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
};
