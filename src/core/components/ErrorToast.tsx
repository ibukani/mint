import type React from "react";
import { useCallback, useEffect, useRef } from "react";

interface ErrorToastProps {
  message: string | null;
  onDismiss: () => void;
}

export const ErrorToast: React.FC<ErrorToastProps> = ({
  message,
  onDismiss,
}) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    if (!message) return;
    timerRef.current = setTimeout(onDismiss, 5000);
  }, [clearTimer, message, onDismiss]);

  useEffect(() => {
    if (!message) {
      clearTimer();
      return undefined;
    }

    closeButtonRef.current?.focus();
    startTimer();
    return clearTimer;
  }, [clearTimer, message, startTimer]);

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
    <div
      className="error-toast"
      role="alert"
      onMouseEnter={clearTimer}
      onMouseLeave={startTimer}
      onFocus={clearTimer}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          startTimer();
        }
      }}
    >
      <div className="error-toast-body">
        <span className="error-toast-message">{message}</span>
        <span className="error-toast-hint">Esc でも閉じられます。</span>
      </div>
      <button
        ref={closeButtonRef}
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
