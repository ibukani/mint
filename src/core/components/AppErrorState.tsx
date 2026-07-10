import { CircleAlert } from "lucide-react";
import type React from "react";
import { Button } from "../../design/components";
import "./AppFeedback.css";

interface AppErrorStateProps {
  message: string;
  onRetry: () => void;
}

export const AppErrorState: React.FC<AppErrorStateProps> = ({
  message,
  onRetry,
}) => (
  <section className="app-error-state" aria-labelledby="app-error-title">
    <div className="app-error-state__icon" aria-hidden="true">
      <CircleAlert size={20} />
    </div>
    <h2 id="app-error-title">設定を読み込めませんでした</h2>
    <p>{message}</p>
    <Button onClick={onRetry}>再読み込み</Button>
  </section>
);
