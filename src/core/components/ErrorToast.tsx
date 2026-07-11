import { CircleAlert, X } from "lucide-react";
import "./ErrorToast.css";
import type React from "react";
import { useCallback, useEffect, useRef } from "react";

interface ErrorToastProps {
  message: string | null;
  onDismiss: () => void;
  onRetry?: () => void | Promise<void>;
}

export const ErrorToast: React.FC<ErrorToastProps> = ({
  message,
  onDismiss,
  onRetry,
}) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const retryButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    if (!message || onRetry) return;
    timerRef.current = setTimeout(onDismiss, 5000);
  }, [clearTimer, message, onDismiss, onRetry]);

  useEffect(() => {
    if (!message) {
      clearTimer();
      return undefined;
    }

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    (onRetry ? retryButtonRef.current : closeButtonRef.current)?.focus();
    startTimer();
    return clearTimer;
  }, [clearTimer, message, onRetry, startTimer]);

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

  useEffect(() => {
    if (message) return undefined;

    const restoreTarget = restoreFocusRef.current;
    restoreFocusRef.current = null;

    if (restoreTarget && document.contains(restoreTarget)) {
      restoreTarget.focus();
    }

    return undefined;
  }, [message]);

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
      <CircleAlert className="error-toast__icon" size={18} aria-hidden="true" />
      <div className="error-toast-body">
        <span className="error-toast-message">{message}</span>
        <span className="error-toast-hint">
          {onRetry
            ? "再試行するまで未保存の変更を保持します。"
            : "Esc でも閉じられます。"}
        </span>
        {onRetry && (
          <button
            ref={retryButtonRef}
            type="button"
            className="error-toast-retry"
            onClick={() => void onRetry()}
          >
            もう一度保存
          </button>
        )}
      </div>
      <button
        ref={closeButtonRef}
        type="button"
        className="error-toast-close"
        aria-label="エラー通知を閉じる"
        onClick={onDismiss}
      >
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  );
};
