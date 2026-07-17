import { ExternalLink, Star } from "lucide-react";
import type React from "react";
import type { MutableRefObject } from "react";
import type { InstalledGame } from "../types";
import { GameArtwork } from "./GameArtwork";
import { gameDomId, storeLabel } from "./gameLauncherPresentation";

interface GameLauncherGameListProps {
  games: InstalledGame[];
  activeIndex: number;
  favoriteGameKeySet: Set<string>;
  lastPlayedAtByGame: Record<string, string>;
  launchingGameKey: string | null;
  openingStoreId: string | null;
  listRef: React.RefObject<HTMLElement | null>;
  itemRefs: MutableRefObject<Array<HTMLButtonElement | null>>;
  onSelect: (game: InstalledGame) => void;
  onLaunch: (game: InstalledGame) => void;
  onToggleFavorite: (game: InstalledGame) => void;
  onOpenStore: (game: InstalledGame) => void;
  loading: boolean;
  query: string;
}

export const GameLauncherGameList: React.FC<GameLauncherGameListProps> = ({
  games,
  activeIndex,
  favoriteGameKeySet,
  lastPlayedAtByGame,
  launchingGameKey,
  openingStoreId,
  listRef,
  itemRefs,
  onSelect,
  onLaunch,
  onToggleFavorite,
  onOpenStore,
  loading,
  query,
}) => (
  <section
    id="game-launcher-list"
    ref={listRef}
    className="game-launcher__list"
    aria-label="ゲーム一覧"
    data-window-drag-block
  >
    {loading ? (
      <div className="game-launcher__state">ゲームをスキャンしています…</div>
    ) : games.length ? (
      games.map((game, index) => {
        const key = `${game.store}:${game.id}`;
        const favorite = favoriteGameKeySet.has(key);
        const lastPlayed = lastPlayedAtByGame[key];
        return (
          <div
            key={key}
            className={`game-launcher__item${index === activeIndex ? " is-selected" : ""}`}
          >
            <button
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              type="button"
              id={gameDomId(game)}
              className="game-launcher__launch"
              aria-current={index === activeIndex ? "true" : undefined}
              onMouseEnter={() => onSelect(game)}
              onFocus={() => onSelect(game)}
              onClick={() => onLaunch(game)}
              disabled={launchingGameKey !== null}
            >
              <GameArtwork game={game} />
              <span className="game-launcher__item-copy">
                <strong>{game.title}</strong>
                <small>
                  {storeLabel[game.store]}
                  {lastPlayed
                    ? ` · 最終プレイ ${new Date(lastPlayed).toLocaleDateString("ja-JP")}`
                    : " · 未プレイ"}
                </small>
              </span>
            </button>
            <button
              type="button"
              className={`game-launcher__action${favorite ? " is-favorite" : ""}`}
              onFocus={() => onSelect(game)}
              onClick={() => onToggleFavorite(game)}
              aria-label={`${game.title}を${favorite ? "お気に入りから削除" : "お気に入りに追加"}`}
              aria-pressed={favorite}
            >
              <Star
                size={16}
                fill={favorite ? "currentColor" : "none"}
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              className="game-launcher__action"
              onFocus={() => onSelect(game)}
              onClick={() => onOpenStore(game)}
              aria-label={`${game.title}のストア管理画面を開く`}
              disabled={openingStoreId === key}
            >
              <ExternalLink size={16} aria-hidden="true" />
            </button>
          </div>
        );
      })
    ) : (
      <div className="game-launcher__state">
        <strong>
          {query ? "一致するゲームがありません" : "ゲームが見つかりません"}
        </strong>
        {!query && (
          <span>Steam、Epic Games、Riot Gamesを確認してください。</span>
        )}
      </div>
    )}
  </section>
);
