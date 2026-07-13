import { LoaderCircle } from "lucide-react";
import type React from "react";
import "./AppFeedback.css";

interface AppLoadingProps {
  compact?: boolean;
}

export const AppLoading: React.FC<AppLoadingProps> = ({ compact = false }) => (
  <div
    className={`app-loading ${compact ? "app-loading--compact" : ""}`}
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <div className="app-loading__visual" aria-hidden="true">
      <LoaderCircle className="spinner-icon" size={20} />
    </div>
    <p className="app-loading__message">
      <strong>
        {compact ? "設定画面を準備しています" : "mintを準備しています"}
      </strong>
      {!compact && <span>設定を読み込み中...</span>}
    </p>
  </div>
);
