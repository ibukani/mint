import { RotateCcw } from "lucide-react";
import { useState } from "react";
import "./WindowStateResetSettings.css";
import type React from "react";
import { Button, StatusBadge } from "../../../design/components";
import { resetWindowState, type WindowStateTarget } from "../../windowCommands";

const resetTargets: ReadonlyArray<{ label: WindowStateTarget; name: string }> =
  [
    { label: "main", name: "設定画面" },
    { label: "quickCapture", name: "クイックキャプチャー" },
    { label: "gameLauncher", name: "ゲームランチャー" },
    { label: "calendar", name: "カレンダー" },
    { label: "calendarEditor", name: "カレンダーエディター" },
  ];

type ResetFeedback = { message: string; isError: boolean } | null;

export const WindowStateResetSettings: React.FC = () => {
  const [feedback, setFeedback] = useState<ResetFeedback>(null);

  const handleReset = (label: WindowStateTarget, name: string) => {
    setFeedback(null);
    void resetWindowState(label).then(
      () =>
        setFeedback({
          message: `${name}の位置・サイズを既定値に戻しました`,
          isError: false,
        }),
      () =>
        setFeedback({
          message: `${name}のリセットに失敗しました`,
          isError: true,
        }),
    );
  };

  return (
    <section className="settings-group" aria-labelledby="window-state-title">
      <div className="settings-group__heading">
        <RotateCcw size={18} aria-hidden="true" />
        <div>
          <h3 id="window-state-title">位置・サイズ</h3>
          <p>移動やサイズ変更の記憶を消して、既定の位置に戻します。</p>
        </div>
      </div>

      <ul className="window-state-reset__list">
        {resetTargets.map(({ label, name }) => (
          <li className="window-state-reset__item" key={label}>
            <span className="window-state-reset__name">{name}</span>
            <Button
              variant="ghost"
              onClick={() => handleReset(label, name)}
              aria-label={`${name}の位置・サイズをリセット`}
            >
              <RotateCcw size={14} aria-hidden="true" />
              リセット
            </Button>
          </li>
        ))}
      </ul>

      {feedback && (
        <p
          className="window-state-reset__result"
          role="status"
          aria-live="polite"
        >
          <StatusBadge tone={feedback.isError ? "disabled" : "enabled"}>
            {feedback.message}
          </StatusBadge>
        </p>
      )}
    </section>
  );
};
