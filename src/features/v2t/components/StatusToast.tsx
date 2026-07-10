import type React from "react";

const isErrorStatus = (status: string) =>
  ["失敗", "ありません", "エラー", "ませんでした"].some((token) =>
    status.includes(token),
  );

export const StatusToast: React.FC<{ message: string }> = ({ message }) => (
  <span
    className={`status-toast-label ${isErrorStatus(message) ? "status-toast-label--error" : ""}`}
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    {message}
  </span>
);
