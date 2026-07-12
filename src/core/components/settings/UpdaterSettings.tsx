import {
  AlertTriangle,
  CheckCircle2,
  Download,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import "./UpdaterSettings.css";
import type React from "react";
import { Button, StatusBadge } from "../../../design/components";
import { useUpdater } from "../../hooks/useUpdater";

const statusLabels = {
  idle: "更新を確認できます",
  checking: "更新を確認中...",
  available: "新しいバージョンがあります",
  upToDate: "最新バージョンです",
  downloading: "アップデートをダウンロード中...",
  installing: "アップデートをインストール中...",
  installed: "再起動しています...",
  restartRequired: "手動で再起動してください",
  unsupported: "ブラウザでは利用できません",
  error: "更新を確認できませんでした",
} as const;

const formatReleaseDate = (date: string | undefined) => {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(
    parsed,
  );
};

export const UpdaterSettings: React.FC = () => {
  const { status, update, progress, error, checkForUpdate, installUpdate } =
    useUpdater();
  const isChecking = status === "checking";
  const isInstalling =
    status === "downloading" ||
    status === "installing" ||
    status === "installed";
  const canInstall =
    update !== null && (status === "available" || status === "error");
  const showInstallAction = update !== null && (canInstall || isInstalling);
  const releaseDate = formatReleaseDate(update?.date);
  const statusLabel =
    status === "error" && update
      ? "アップデートに失敗しました"
      : statusLabels[status];

  return (
    <section className="settings-group" aria-labelledby="update-title">
      <div className="settings-group__heading">
        <Download size={18} aria-hidden="true" />
        <div>
          <h3 id="update-title">アップデート</h3>
          <p>mint の新しいバージョンを確認して、最新の状態に保ちます。</p>
        </div>
      </div>

      <div className="updater-settings">
        <div
          className="updater-settings__status"
          role="status"
          aria-live="polite"
        >
          {status === "error" || status === "restartRequired" ? (
            <AlertTriangle size={16} aria-hidden="true" />
          ) : isChecking ||
            status === "downloading" ||
            status === "installing" ? (
            <LoaderCircle
              className="spinner-icon"
              size={16}
              aria-hidden="true"
            />
          ) : (
            <CheckCircle2 size={16} aria-hidden="true" />
          )}
          <span>{statusLabel}</span>
          {status === "available" && update && (
            <StatusBadge tone="info">v{update.version}</StatusBadge>
          )}
        </div>

        {update && (
          <p className="updater-settings__version">
            <span>現在 v{update.currentVersion}</span>
            <span aria-hidden="true">→</span>
            <strong>v{update.version}</strong>
            {releaseDate && <span>（{releaseDate}）</span>}
          </p>
        )}
        {update?.body && (
          <section
            className="updater-settings__notes"
            aria-labelledby="updater-release-notes-title"
            data-window-drag-block
          >
            <h4 id="updater-release-notes-title">リリースノート</h4>
            <p>{update.body}</p>
          </section>
        )}
        {error && <p className="updater-settings__error">{error}</p>}
        {(status === "downloading" || status === "installing") && (
          <div
            className={`updater-settings__progress ${progress === null ? "is-indeterminate" : ""}`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress === null ? undefined : Math.round(progress)}
            aria-label={
              progress === null
                ? "アップデートを処理中"
                : `進捗 ${Math.round(progress)}%`
            }
          >
            <div
              style={progress === null ? undefined : { width: `${progress}%` }}
            />
          </div>
        )}

        <div className="updater-settings__actions">
          {showInstallAction && (
            <Button
              onClick={() => void installUpdate()}
              disabled={isInstalling}
            >
              {status === "downloading"
                ? "ダウンロード中..."
                : status === "installing"
                  ? "インストール中..."
                  : status === "installed"
                    ? "再起動しています..."
                    : canInstall && status === "error"
                      ? "インストールを再試行"
                      : "ダウンロードして再起動"}
            </Button>
          )}
          <Button
            variant={canInstall ? "ghost" : "primary"}
            onClick={() => void checkForUpdate()}
            disabled={
              isChecking ||
              isInstalling ||
              status === "restartRequired" ||
              status === "unsupported"
            }
          >
            <RefreshCw
              size={15}
              aria-hidden="true"
              className={isChecking ? "spinner-icon" : undefined}
            />
            更新を確認
          </Button>
        </div>
      </div>
    </section>
  );
};
