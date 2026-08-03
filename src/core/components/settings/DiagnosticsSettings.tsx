import { ClipboardCopy, LoaderCircle } from "lucide-react";
import { useState } from "react";
import "./DiagnosticsSettings.css";
import type React from "react";
import { Button, StatusBadge } from "../../../design/components";
import {
  collectDiagnostics,
  type DiagnosticsReport,
  renderDiagnosticsMarkdown,
} from "../../performance/diagnostics";
import { sanitizeDiagnosticsText } from "../../performance/report";

type CopyState = "idle" | "loading" | "copied" | "error";

const writeClipboard = (text: string): Promise<void> => {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return Promise.reject(new Error("クリップボードを利用できません。"));
};

export const DiagnosticsSettings: React.FC = () => {
  const [state, setState] = useState<CopyState>("idle");
  const [message, setMessage] = useState("");
  const [lastSummary, setLastSummary] = useState<string | null>(null);

  const handleCopy = () => {
    setState("loading");
    setMessage("");
    void collectDiagnostics()
      .then((report: DiagnosticsReport) => {
        const markdown = sanitizeDiagnosticsText(
          renderDiagnosticsMarkdown(report),
        );
        return writeClipboard(markdown).then(() => report);
      })
      .then((report) => {
        setLastSummary(
          `計測イベント ${report.events.length} 件、カウンター ${Object.keys(report.counters).length} 件、保存データ ${Object.values(report.dataCounts).reduce((sum, count) => sum + count, 0)} 件`,
        );
        setState("copied");
        setMessage("診断情報をコピーしました。");
      })
      .catch((error: unknown) => {
        setState("error");
        setMessage(
          error instanceof Error
            ? `診断情報を取得できませんでした: ${error.message}`
            : "診断情報を取得できませんでした。",
        );
      });
  };

  return (
    <section className="settings-group" aria-labelledby="diagnostics-title">
      <div className="settings-group__heading">
        <ClipboardCopy size={18} aria-hidden="true" />
        <div>
          <h3 id="diagnostics-title">診断情報</h3>
          <p>
            動作環境と計測データをまとめてコピーし、トラブル報告に利用します。
          </p>
        </div>
      </div>

      <p className="diagnostics-settings__notice">
        診断情報には API
        キーやトークン、メモの本文、予定の内容、ファイルの完全な
        パスは含まれません。
      </p>

      <Button
        variant="ghost"
        onClick={handleCopy}
        disabled={state === "loading"}
        aria-label="診断情報をコピー"
      >
        {state === "loading" ? (
          <LoaderCircle
            className="diagnostics-settings__spinner"
            size={14}
            aria-hidden="true"
          />
        ) : (
          <ClipboardCopy size={14} aria-hidden="true" />
        )}
        {state === "loading" ? "取得中…" : "診断情報をコピー"}
      </Button>

      {message && (
        <p
          className="diagnostics-settings__result"
          role="status"
          aria-live="polite"
        >
          <StatusBadge tone={state === "error" ? "disabled" : "enabled"}>
            {message}
          </StatusBadge>
        </p>
      )}

      {lastSummary && (
        <p className="diagnostics-settings__summary">{lastSummary}</p>
      )}
    </section>
  );
};
