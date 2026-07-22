import { Gamepad2, RefreshCw, Search, X } from "lucide-react";
import type React from "react";
import { OverlayCard, OverlayFrame } from "../../../design/layout";
import { useGameLauncher } from "../hooks/useGameLauncher";
import { useGameLauncherList } from "../hooks/useGameLauncherList";
import { gameKey } from "../types";
import { GameArtwork } from "./GameArtwork";
import { GameLauncherGameList } from "./GameLauncherGameList";
import { GameLauncherPreview } from "./GameLauncherPreview";
import { storeLabel } from "./gameLauncherPresentation";
import "./GameLauncherOverlay.css";

export { GameArtwork };

export const GameLauncherOverlay: React.FC = () => {
  const launcher = useGameLauncher();
  const list = useGameLauncherList({
    result: launcher.result,
    favoriteGameKeys: launcher.favoriteGameKeys,
    lastPlayedAtByGame: launcher.lastPlayedAtByGame,
    showSequence: launcher.showSequence,
    close: launcher.close,
    startGame: launcher.startGame,
  });
  const selectedKey = list.selected ? gameKey(list.selected) : null;
  const warning = launcher.result?.sources
    .filter((source) => source.warning)
    .map((source) => `${storeLabel[source.store]}を確認できません`)
    .join(" · ");

  return (
    <OverlayFrame>
      <OverlayCard
        className={`${launcher.animationClass} game-launcher theme-accent-scope`}
        role="dialog"
        aria-label="ゲームランチャー"
        onKeyDown={list.handleOverlayKeyDown}
        style={{ "--color-accent": launcher.themeColor } as React.CSSProperties}
      >
        <header className="game-launcher__header">
          <div className="game-launcher__title">
            <Gamepad2 size={20} aria-hidden="true" />
            <div>
              <h1>ゲームランチャー</h1>
              <p>
                {list.query
                  ? `${list.games.length}/${launcher.result?.games.length ?? 0}本に絞り込み`
                  : `${launcher.result?.games.length ?? 0}本のゲーム`}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="overlay-close-button"
            onClick={launcher.close}
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
            ref={list.inputRef}
            type="search"
            aria-label="ゲームを検索"
            aria-controls="game-launcher-list"
            aria-activedescendant={
              list.selected
                ? `game-launcher-game-${selectedKey?.replace(/[^a-zA-Z0-9_-]/g, "-")}`
                : undefined
            }
            aria-keyshortcuts={`ArrowDown ArrowUp Home End PageUp PageDown Enter Escape ${list.searchShortcutModifier}+F`}
            value={list.query}
            onKeyDown={list.handleSearchKeyDown}
            onChange={(event) => list.onQueryChange(event.target.value)}
            placeholder="ゲームまたはストアを検索"
            autoComplete="off"
          />
          {list.query ? (
            <button
              type="button"
              className="game-launcher__search-clear"
              aria-label="ゲーム検索をクリア"
              title="検索をクリア"
              onClick={list.clearQuery}
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
          <GameLauncherGameList
            games={list.games}
            activeIndex={list.activeIndex}
            favoriteGameKeySet={list.favoriteGameKeySet}
            lastPlayedAtByGame={launcher.lastPlayedAtByGame}
            launchingGameKey={launcher.launchingGameKey}
            openingStoreId={launcher.openingStoreId}
            listRef={list.listRef}
            itemRefs={list.itemRefs}
            onSelect={(game) => list.setSelectedGameKey(gameKey(game))}
            onLaunch={(game) => void launcher.startGame(game)}
            onToggleFavorite={launcher.toggleFavorite}
            onOpenStore={(game) => void launcher.openStorePage(game)}
            loading={launcher.loading}
            query={list.query}
          />
          <GameLauncherPreview
            game={list.selected}
            lastPlayedAt={
              list.selected
                ? launcher.lastPlayedAtByGame[gameKey(list.selected)]
                : undefined
            }
            launching={Boolean(
              list.selected &&
                launcher.launchingGameKey === gameKey(list.selected),
            )}
            storeOpening={Boolean(
              list.selected &&
                launcher.openingStoreId === gameKey(list.selected),
            )}
            onLaunch={(game) => void launcher.startGame(game)}
            onOpenStore={(game) => void launcher.openStorePage(game)}
          />
        </div>

        <footer className="game-launcher__footer">
          <span
            className={launcher.error ? "is-error" : ""}
            role={launcher.error ? "alert" : "status"}
            aria-live="polite"
          >
            {launcher.error ?? warning}
          </span>
          <button
            type="button"
            onClick={() => void launcher.scan(true)}
            disabled={launcher.loading}
          >
            <RefreshCw size={14} aria-hidden="true" /> 再スキャン
          </button>
        </footer>
      </OverlayCard>
    </OverlayFrame>
  );
};
