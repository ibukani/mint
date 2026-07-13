import type React from "react";
import type { StatusTone } from "../types";

export const StatusToast: React.FC<{
  message: string;
  tone?: StatusTone;
}> = ({ message, tone = "success" }) => (
  <span
    className={`status-toast-label status-toast-label--${tone}`}
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    {message}
  </span>
);
