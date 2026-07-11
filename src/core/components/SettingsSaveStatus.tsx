import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import type React from "react";
import type { SaveStatus } from "../context/AppSettings";
import "./AppFeedback.css";

const labels: Record<SaveStatus, string> = {
  idle: "",
  pending: "保存待ち...",
  saving: "保存中...",
  saved: "保存完了",
  error: "保存失敗",
};

const icons: Record<SaveStatus, React.ReactNode> = {
  idle: null,
  pending: (
    <LoaderCircle className="spinner-icon" size={14} aria-hidden="true" />
  ),
  saving: (
    <LoaderCircle className="spinner-icon" size={14} aria-hidden="true" />
  ),
  saved: <Check size={14} aria-hidden="true" />,
  error: <CircleAlert size={14} aria-hidden="true" />,
};

interface SettingsSaveStatusProps {
  status: SaveStatus;
  onRetry?: () => void | Promise<void>;
}

export const SettingsSaveStatus: React.FC<SettingsSaveStatusProps> = ({
  status,
  onRetry,
}) => (
  <div
    className={`settings-save-status settings-save-status--${status}`}
    role={status === "idle" ? undefined : "status"}
    aria-hidden={status === "idle"}
  >
    {icons[status]}
    <span>{labels[status]}</span>
    {status === "error" && onRetry && (
      <button type="button" onClick={() => void onRetry()}>
        再試行
      </button>
    )}
  </div>
);
