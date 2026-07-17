import {
  ExternalLink,
  Gamepad2,
  Play,
  RefreshCw,
  Search,
  Star,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  isApplePlatform,
  OverlayCard,
  OverlayFrame,
  revealElementVertically,
} from "../../../design/layout";
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

const gameDomId = (game: InstalledGame) =>
  `game-launcher-game-${gameKey(game).replace(/[^a-zA-Z0-9_-]/g, "-")}`;

const GAME_PAGE_STEP = 5;

export const GameArtwork = React.memo(({ game }: { game: InstalledGame }) => {
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
});

export const GameLauncherOverlay: React.FC = () => {
  const {
    animationClass,
    close,
    error,
    launchingGameKey,
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
  const [selectedGameKey, setSelectedGameKey] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const searchShortcutModifier = isApplePlatform() ? "Meta" : "Control";

  const searchableGames = useMemo(
    () =>
      (result?.games ?? []).map((game) => {
        const key = gameKey(game);
        return {
          game,
          key,
          title: game.title.toLocaleLowerCase("ja"),
          store: storeLabel[game.store].toLocaleLowerCase("ja"),
          acronym: getAcronym(game.title).toLocaleLowerCase("ja"),
          lastPlayedAt: Date.parse(lastPlayedAtByGame[key] ?? "") || 0,
        };
      }),
    [lastPlayedAtByGame, result],
  );
  const favoriteGameKeySet = useMemo(
    () => new Set(favoriteGameKeys),
    [favoriteGameKeys],
  );
  const orderedGames = useMemo(() => {
    return [...searchableGames].sort((left, right) => {
      const favoriteDifference =
        Number(favoriteGameKeySet.has(right.key)) -
        Number(favoriteGameKeySet.has(left.key));
      if (favoriteDifference) return favoriteDifference;
      return (
        right.lastPlayedAt - left.lastPlayedAt ||
        left.game.title.localeCompare(right.game.title, "ja")
      );
    });
  }, [favoriteGameKeySet, searchableGames]);
  const games = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("ja");
    if (!term) return orderedGames.map(({ game }) => game);
    return orderedGames
      .filter(
        ({ title, store, acronym }) =>
          title.includes(term) ||
          store.includes(term) ||
          acronym.includes(term),
      )
      .map(({ game }) => game);
  }, [orderedGames, query]);

  // A new show sequence starts with a fresh search session.
  // biome-ignore lint/correctness/useExhaustiveDependencies: showSequence is an explicit show signal.
  useEffect(() => {
    setQuery("");
    setSelectedGameKey(null);
    inputRef.current?.focus({ preventScroll: true });
  }, [showSequence]);

  const activeIndex = games.length
    ? Math.max(
        0,
        games.findIndex((game) => gameKey(game) === selectedGameKey),
      )
    : 0;
  const selected = games[activeIndex];

  useEffect(() => {
    if (!games.length) {
      if (selectedGameKey !== null) setSelectedGameKey(null);
      return;
    }
    if (
      !selectedGameKey ||
      !games.some((game) => gameKey(game) === selectedGameKey)
    ) {
      setSelectedGameKey(gameKey(games[0]));
    }
  }, [games, selectedGameKey]);

  useEffect(() => {
    const list = listRef.current;
    const item = itemRefs.current[activeIndex];
    if (list && item) revealElementVertically(list, item, 4);
  }, [activeIndex]);

  const selectIndex = (index: number) => {
    const game = games[index];
    if (game) setSelectedGameKey(gameKey(game));
  };

  const handleOverlayKeyDown = (event: React.KeyboardEvent) => {
    const key = event.key.toLocaleLowerCase();
    const modifierPressed = event.ctrlKey || event.metaKey;
    if (event.altKey && event.key === "1") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (modifierPressed && key === "f") {
      event.preventDefault();
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.select();
    } else if (
      event.key === "/" &&
      event.target !== inputRef.current &&
      !modifierPressed &&
      !event.altKey
    ) {
      event.preventDefault();
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.select();
    } else if (event.key === "Escape") {
      event.preventDefault();
      if (query) {
        setQuery("");
        setSelectedGameKey(null);
        inputRef.current?.focus({ preventScroll: true });
      } else {
        close();
      }
    }
  };

  const handleSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "ArrowDown" && games.length) {
      event.preventDefault();
      event.stopPropagation();
      selectIndex((activeIndex + 1) % games.length);
    } else if (event.key === "ArrowUp" && games.length) {
      event.preventDefault();
      event.stopPropagation();
      selectIndex((activeIndex - 1 + games.length) % games.length);
    } else if (event.key === "PageDown" && games.length) {
      event.preventDefault();
      event.stopPropagation();
      selectIndex(Math.min(games.length - 1, activeIndex + GAME_PAGE_STEP));
    } else if (event.key === "PageUp" && games.length) {
      event.preventDefault();
      event.stopPropagation();
      selectIndex(Math.max(0, activeIndex - GAME_PAGE_STEP));
    } else if (event.key === "Home" && games.length) {
      event.preventDefault();
      event.stopPropagation();
      selectIndex(0);
    } else if (event.key === "End" && games.length) {
      event.preventDefault();
      event.stopPropagation();
      selectIndex(games.length - 1);
    } else if (event.key === "Enter" && selected) {
      event.preventDefault();
      event.stopPropagation();
      void startGame(selected);
    }
  };

  return (
    <OverlayFrame>
      <OverlayCard
        className={`${animationClass} game-launcher theme-accent-scope`}
        role="dialog"
        aria-label="ゲームランチャー"
        onKeyDown={handleOverlayKeyDown}
        style={{ "--color-accent": themeColor } as React.CSSProperties}
      >
        <header className="game-launcher__header">
          <div className="game-launcher__title">
            <Gamepad2 size={20} aria-hidden="true" />
            <div>
              <h1>ゲームランチャー</h1>
              <p>
                {query
                  ? `${games.length}/${result?.games.length ?? 0}本に絞り込み`
                  : `${result?.games.length ?? 0}本のゲーム`}
              </p>
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
            type="search"
            aria-label="ゲームを検索"
            aria-controls="game-launcher-list"
            aria-activedescendant={selected ? gameDomId(selected) : undefined}
            aria-keyshortcuts={`ArrowDown ArrowUp Home End PageUp PageDown Enter Escape ${searchShortcutModifier}+F`}
            value={query}
            onKeyDown={handleSearchKeyDown}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedGameKey(null);
            }}
            placeholder="ゲームまたはストアを検索"
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              className="game-launcher__search-clear"
              aria-label="ゲーム検索をクリア"
              title="検索をクリア"
              onClick={() => {
                setQuery("");
                setSelectedGameKey(null);
                inputRef.current?.focus({ preventScroll: true });
              }}
            >
              <X size={15} aria-hidden="true" />
            </button>
          ) : (
            <kbd
              aria-label="上下、Home、End、PageUp、PageDownキーで選択、Enterで起動"
              title="↑↓: 1件移動 / PageUp・PageDown: 5件移動 / Home・End: 先頭・末尾 / Enter: 起動"
            >
              ↑ ↓ PgUp PgDn Enter
            </kbd>
          )}
        </label>

        <div className="game-launcher__body">
          <section
            id="game-launcher-list"
            ref={listRef}
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
                      onMouseEnter={() => setSelectedGameKey(key)}
                      onFocus={() => setSelectedGameKey(key)}
                      onClick={() => void startGame(game)}
                      disabled={launchingGameKey !== null}
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
                      onFocus={() => setSelectedGameKey(key)}
                      onClick={() => {
                        setSelectedGameKey(key);
                        toggleFavorite(game);
                      }}
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
                      onFocus={() => setSelectedGameKey(key)}
                      onClick={() => {
                        setSelectedGameKey(key);
                        void openStorePage(game);
                      }}
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
                    disabled={launchingGameKey !== null}
                    onClick={() => void startGame(selected)}
                  >
                    <Play size={15} aria-hidden="true" />
                    {launchingGameKey === gameKey(selected)
                      ? "起動中…"
                      : "起動"}
                  </button>
                  <button
                    type="button"
                    disabled={
                      openingStoreId !== null || launchingGameKey !== null
                    }
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
          <button
            type="button"
            onClick={() => void scan(true)}
            disabled={loading}
          >
            <RefreshCw size={14} aria-hidden="true" /> 再スキャン
          </button>
        </footer>
      </OverlayCard>
    </OverlayFrame>
  );
};
