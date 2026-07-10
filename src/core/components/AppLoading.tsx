import { LoaderCircle } from "lucide-react";
import type React from "react";
import "./AppFeedback.css";

interface AppLoadingProps {
  compact?: boolean;
}

export const AppLoading: React.FC<AppLoadingProps> = ({ compact = false }) => (
  <div
    className="app-loading"
    role="status"
    aria-live={compact ? undefined : "polite"}
    aria-busy="true"
  >
    <div className="app-loading__visual" aria-hidden="true">
      <LoaderCircle className="spinner-icon" size={20} />
    </div>
    {!compact && (
      <p className="app-loading__message">
        <strong>mintを準備しています</strong>
        <span>設定を読み込み中...</span>
      </p>
    )}
  </div>
);
