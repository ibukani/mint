import {
  ExternalLink,
  Gamepad2,
  Play,
  RefreshCw,
  Search,
  Star,
  X,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { OverlayCard, OverlayFrame } from "../../../design/layout";
import { useGameLauncher } from "../hooks/useGameLauncher";
import { type GameStore, gameKey, type InstalledGame } from "../types";
import "./GameLauncherOverlay.css";

const storeLabel: Record<GameStore, string> = {
  steam: "Steam",
  epic: "Epic Games",
  riot: "Riot Games",
};

function getAcronym(title: string): string {
  const words = title.split(/[^a-zA-Z0-9]+/);
  return words
    .map((w) => w.charAt(0))
    .join("")
    .toLowerCase();
}

function getArtworkLabel(title: string): string {
  const acronym = getAcronym(title).toUpperCase();
  return acronym.length > 1
    ? acronym.slice(0, 3)
    : title.trim().slice(0, 1).toUpperCase();
}

export const GameArtwork: React.FC<{ game: InstalledGame }> = ({ game }) => {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const source =
    game.imagePath && failedSource !== game.imagePath
      ? game.imagePath
      : game.fallbackImagePath && failedSource !== game.fallbackImagePath
        ? game.fallbackImagePath
        : null;
  if (source) {
    return (
      <span
        className={`game-launcher__artwork-shell is-${game.store}`}
        aria-hidden="true"
      >
        <span className="game-launcher__artwork-initial">
          {getArtworkLabel(game.title)}
        </span>
        <img
          className={`game-launcher__artwork${loadedSource === source ? " is-loaded" : ""}`}
          src={source}
          alt=""
          onLoad={() => setLoadedSource(source)}
          onError={() => setFailedSource(source)}
        />
      </span>
    );
  }
  return (
    <span
      className={`game-launcher__placeholder is-${game.store}`}
      aria-hidden="true"
    >
      {getArtworkLabel(game.title)}
    </span>
  );
};

export const GameLauncherOverlay: React.FC = () => {
  const {
    animationClass,
    close,
    error,
    launchingId,
    openingStoreId,
    loading,
    result,
    scan,
    showSequence,
    startGame,
    openStorePage,
    toggleFavorite,
    favoriteGameKeys,
    lastPlayedAtByGame,
    themeColor,
  } = useGameLauncher();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const games = useMemo(() => {
    const rawGames = result?.games ?? [];
    const normalized = query.trim();
    let filtered = rawGames;
    if (normalized) {
      const term = normalized.toLocaleLowerCase("ja");
      filtered = rawGames.filter((game) =>
        [game.title, storeLabel[game.store], getAcronym(game.title)].some(
          (candidate) => candidate.toLocaleLowerCase("ja").includes(term),
        ),
      );
    }
    const favoriteSet = new Set(favoriteGameKeys);
    return [...filtered].sort((left, right) => {
      const leftKey = gameKey(left);
      const rightKey = gameKey(right);
      const favoriteDifference =
        Number(favoriteSet.has(rightKey)) - Number(favoriteSet.has(leftKey));
      if (favoriteDifference) return favoriteDifference;
      const recentDifference =
        (Date.parse(lastPlayedAtByGame[rightKey] ?? "") || 0) -
        (Date.parse(lastPlayedAtByGame[leftKey] ?? "") || 0);
      return recentDifference || left.title.localeCompare(right.title, "ja");
    });
  }, [favoriteGameKeys, lastPlayedAtByGame, query, result]);

  useEffect(() => {
    void showSequence;
    setQuery("");
    setSelectedIndex(0);
    inputRef.current?.focus();
  }, [showSequence]);
  const activeIndex = games.length ? selectedIndex % games.length : 0;
  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const selected = games[activeIndex];
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.altKey && event.key === "1") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.target !== inputRef.current) {
      return;
    } else if (event.key === "ArrowDown" && games.length) {
      event.preventDefault();
      setSelectedIndex((current) => (current + 1) % games.length);
    } else if (event.key === "ArrowUp" && games.length) {
      event.preventDefault();
      setSelectedIndex(
        (current) => (current - 1 + games.length) % games.length,
      );
    } else if (event.key === "Enter" && selected) {
      event.preventDefault();
      void startGame(selected);
    }
  };

  return (
    <OverlayFrame>
      <OverlayCard
        className={`${animationClass} game-launcher theme-accent-scope`}
        role="dialog"
        aria-label="ゲームランチャー"
        onKeyDown={handleKeyDown}
        style={{ "--color-accent": themeColor } as React.CSSProperties}
      >
        <header className="game-launcher__header">
          <div className="game-launcher__title">
            <Gamepad2 size={20} aria-hidden="true" />
            <div>
              <h1>ゲームランチャー</h1>
              <p>{result?.games.length ?? 0}本のゲーム</p>
            </div>
          </div>
          <button
            type="button"
            className="overlay-close-button"
            onClick={close}
            aria-label="閉じる"
            aria-keyshortcuts="Escape"
            title="閉じる（Esc）"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <label className="game-launcher__search">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            aria-label="ゲームを検索"
            aria-controls="game-launcher-list"
            aria-keyshortcuts="ArrowDown ArrowUp Enter"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            placeholder="ゲームまたはストアを検索"
            autoComplete="off"
          />
          <kbd aria-label="上下キーで選択、Enterで起動">↑ ↓ Enter</kbd>
        </label>

        <div className="game-launcher__body">
          <section
            id="game-launcher-list"
            className="game-launcher__list"
            aria-label="ゲーム一覧"
            data-window-drag-block
          >
            {loading ? (
              <div className="game-launcher__state">
                ゲームをスキャンしています…
              </div>
            ) : games.length ? (
              games.map((game, index) => {
                const key = gameKey(game);
                const favorite = favoriteGameKeys.includes(key);
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
                      className="game-launcher__launch"
                      aria-current={index === activeIndex ? "true" : undefined}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => void startGame(game)}
                      disabled={launchingId !== null}
                    >
                      <GameArtwork
                        key={`${key}:${game.imagePath}:${game.fallbackImagePath}`}
                        game={game}
                      />
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
                      onClick={() => toggleFavorite(game)}
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
                      onClick={() => void openStorePage(game)}
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
                  {query
                    ? "一致するゲームがありません"
                    : "ゲームが見つかりません"}
                </strong>
                {!query && (
                  <span>Steam、Epic Games、Riot Gamesを確認してください。</span>
                )}
              </div>
            )}
          </section>

          <aside className="game-launcher__preview" aria-live="polite">
            {selected ? (
              <>
                <GameArtwork
                  key={`${selected.store}:${selected.id}:${selected.imagePath ?? "fallback"}`}
                  game={selected}
                />
                <span className={`game-launcher__store is-${selected.store}`}>
                  {storeLabel[selected.store]}
                </span>
                <h2>{selected.title}</h2>
                <p>
                  {lastPlayedAtByGame[gameKey(selected)]
                    ? `最終プレイ ${new Date(lastPlayedAtByGame[gameKey(selected)]).toLocaleString("ja-JP")}`
                    : "まだプレイしていません"}
                </p>
                <div className="game-launcher__preview-actions">
                  <button
                    type="button"
                    disabled={launchingId !== null}
                    onClick={() => void startGame(selected)}
                  >
                    <Play size={15} aria-hidden="true" />
                    {launchingId === selected.id ? "起動中…" : "起動"}
                  </button>
                  <button
                    type="button"
                    disabled={openingStoreId !== null || launchingId !== null}
                    onClick={() => void openStorePage(selected)}
                  >
                    <ExternalLink size={15} aria-hidden="true" /> 管理画面
                  </button>
                </div>
              </>
            ) : (
              <Gamepad2 size={42} aria-hidden="true" />
            )}
          </aside>
        </div>

        <footer className="game-launcher__footer">
          <span
            className={error ? "is-error" : ""}
            role={error ? "alert" : "status"}
            aria-live="polite"
          >
            {error ??
              result?.sources
                .filter((source) => source.warning)
                .map((source) => `${storeLabel[source.store]}を確認できません`)
                .join(" · ")}
          </span>
          <button type="button" onClick={() => void scan()} disabled={loading}>
            <RefreshCw size={14} aria-hidden="true" /> 再スキャン
          </button>
        </footer>
      </OverlayCard>
    </OverlayFrame>
  );
};
