import { ExternalLink, Gamepad2, Play } from "lucide-react";
import type React from "react";
import type { InstalledGame } from "../types";
import { GameArtwork } from "./GameArtwork";
import { storeLabel } from "./gameLauncherPresentation";

interface GameLauncherPreviewProps {
  game?: InstalledGame;
  lastPlayedAt?: string;
  launching: boolean;
  storeOpening: boolean;
  onLaunch: (game: InstalledGame) => void;
  onOpenStore: (game: InstalledGame) => void;
}

export const GameLauncherPreview: React.FC<GameLauncherPreviewProps> = ({
  game,
  lastPlayedAt,
  launching,
  storeOpening,
  onLaunch,
  onOpenStore,
}) => (
  <aside className="game-launcher__preview" aria-live="polite">
    {game ? (
      <>
        <GameArtwork game={game} />
        <span className={`game-launcher__store is-${game.store}`}>
          {storeLabel[game.store]}
        </span>
        <h2>{game.title}</h2>
        <p>
          {lastPlayedAt
            ? `最終プレイ ${new Date(lastPlayedAt).toLocaleString("ja-JP")}`
            : "まだプレイしていません"}
        </p>
        <div className="game-launcher__preview-actions">
          <button
            type="button"
            disabled={launching}
            onClick={() => onLaunch(game)}
          >
            <Play size={15} aria-hidden="true" />
            {launching ? "起動中…" : "起動"}
          </button>
          <button
            type="button"
            disabled={storeOpening || launching}
            onClick={() => onOpenStore(game)}
          >
            <ExternalLink size={15} aria-hidden="true" /> 管理画面
          </button>
        </div>
      </>
    ) : (
      <Gamepad2 size={42} aria-hidden="true" />
    )}
  </aside>
);
