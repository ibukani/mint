import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAutoClearStatus } from "../hooks/useAutoClearStatus";

interface ErrorToastProps {
  message: string | null;
  onDismiss: () => void;
}

export const ErrorToast: React.FC<ErrorToastProps> = ({
  message,
  onDismiss,
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const clearPausedState = useCallback(() => {
    setIsPaused(false);
  }, []);

  useAutoClearStatus(
    message ?? "",
    onDismiss,
    (currentMessage: string) => (currentMessage ? 5000 : null),
    isPaused,
  );

  useEffect(() => {
    if (!message) {
      clearPausedState();
      return undefined;
    }

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeButtonRef.current?.focus();
    return undefined;
  }, [clearPausedState, message]);

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
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsPaused(false);
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
