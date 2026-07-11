import { convertFileSrc } from "@tauri-apps/api/core";
import { Gamepad2, RefreshCw, Search, X } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { OverlayCard, OverlayFrame } from "../../../design/layout";
import { useGameLauncher } from "../hooks/useGameLauncher";
import type { GameStore, InstalledGame } from "../types";
import "./GameLauncherOverlay.css";

const storeLabel: Record<GameStore, string> = {
  steam: "Steam",
  epic: "Epic Games",
  riot: "Riot Games",
};

const GameArtwork: React.FC<{ game: InstalledGame }> = ({ game }) => {
  const [failed, setFailed] = useState(false);
  if (game.imagePath && !failed) {
    return (
      <img
        className="game-launcher__artwork"
        src={convertFileSrc(game.imagePath)}
        alt=""
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      className={`game-launcher__placeholder is-${game.store}`}
      aria-hidden="true"
    >
      {game.title.slice(0, 1).toUpperCase()}
    </span>
  );
};

export const GameLauncherOverlay: React.FC = () => {
  const {
    animationClass,
    close,
    error,
    launchingId,
    loading,
    result,
    scan,
    startGame,
  } = useGameLauncher();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const games = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return result?.games ?? [];
    return (result?.games ?? []).filter((game) =>
      `${game.title} ${storeLabel[game.store]}`
        .toLocaleLowerCase()
        .includes(normalized),
    );
  }, [query, result]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const selected = games[selectedIndex];
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
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
        className={`${animationClass} game-launcher`}
        role="dialog"
        aria-label="ゲームランチャー"
        onKeyDown={handleKeyDown}
      >
        <header className="game-launcher__header">
          <div className="game-launcher__title">
            <Gamepad2 size={20} aria-hidden="true" />
            <div>
              <h1>Play now</h1>
              <p>{result?.games.length ?? 0} games ready</p>
            </div>
          </div>
          <button
            type="button"
            className="overlay-close-button"
            onClick={close}
            aria-label="閉じる"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <label className="game-launcher__search">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            aria-label="ゲームを検索"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            placeholder="ゲームまたはストアを検索"
            autoComplete="off"
          />
          <kbd>Alt 1</kbd>
        </label>

        <div className="game-launcher__body">
          <section className="game-launcher__list" aria-label="ゲーム一覧">
            {loading ? (
              <div className="game-launcher__state">
                ゲームをスキャンしています…
              </div>
            ) : games.length ? (
              games.map((game, index) => (
                <button
                  ref={(element) => {
                    itemRefs.current[index] = element;
                  }}
                  type="button"
                  key={`${game.store}:${game.id}`}
                  className={`game-launcher__item${index === selectedIndex ? " is-selected" : ""}`}
                  aria-current={index === selectedIndex ? "true" : undefined}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => void startGame(game)}
                  disabled={launchingId !== null}
                >
                  <GameArtwork game={game} />
                  <span className="game-launcher__item-copy">
                    <strong>{game.title}</strong>
                    <small>{storeLabel[game.store]}</small>
                  </span>
                  <span className="game-launcher__enter">
                    {launchingId === game.id ? "起動中…" : "↵"}
                  </span>
                </button>
              ))
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
                <GameArtwork game={selected} />
                <span className={`game-launcher__store is-${selected.store}`}>
                  {storeLabel[selected.store]}
                </span>
                <h2>{selected.title}</h2>
                <p>Enterで公式クライアントから起動</p>
              </>
            ) : (
              <Gamepad2 size={42} aria-hidden="true" />
            )}
          </aside>
        </div>

        <footer className="game-launcher__footer">
          <span className={error ? "is-error" : ""}>
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
