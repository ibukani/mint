import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  isApplePlatform,
  revealElementVertically,
} from "../../../design/layout";
import { getAcronym, storeLabel } from "../components/gameLauncherPresentation";
import type { GameScanResult, InstalledGame } from "../types";
import { gameKey } from "../types";

const GAME_PAGE_STEP = 5;

interface UseGameLauncherListProps {
  result: GameScanResult | null;
  favoriteGameKeys: readonly string[];
  lastPlayedAtByGame: Record<string, string>;
  showSequence: number;
  close: () => void;
  startGame: (game: InstalledGame) => Promise<void>;
}

export const useGameLauncherList = ({
  result,
  favoriteGameKeys,
  lastPlayedAtByGame,
  showSequence,
  close,
  startGame,
}: UseGameLauncherListProps) => {
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
  const orderedGames = useMemo(
    () =>
      [...searchableGames].sort((left, right) => {
        const favoriteDifference =
          Number(favoriteGameKeySet.has(right.key)) -
          Number(favoriteGameKeySet.has(left.key));
        return (
          favoriteDifference ||
          right.lastPlayedAt - left.lastPlayedAt ||
          left.game.title.localeCompare(right.game.title, "ja")
        );
      }),
    [favoriteGameKeySet, searchableGames],
  );
  const games = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("ja");
    return (
      term
        ? orderedGames.filter(
            ({ title, store, acronym }) =>
              title.includes(term) ||
              store.includes(term) ||
              acronym.includes(term),
          )
        : orderedGames
    ).map(({ game }) => game);
  }, [orderedGames, query]);
  const activeIndex = games.length
    ? Math.max(
        0,
        games.findIndex((game) => gameKey(game) === selectedGameKey),
      )
    : 0;
  const selected = games[activeIndex];

  // A show sequence intentionally starts a fresh search session.
  // biome-ignore lint/correctness/useExhaustiveDependencies: showSequence is the explicit show signal.
  useEffect(() => {
    setQuery("");
    setSelectedGameKey(null);
    inputRef.current?.focus({ preventScroll: true });
  }, [showSequence]);

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
    const move = (index: number) => {
      event.preventDefault();
      event.stopPropagation();
      selectIndex(index);
    };
    if (event.key === "ArrowDown" && games.length)
      return move((activeIndex + 1) % games.length);
    if (event.key === "ArrowUp" && games.length)
      return move((activeIndex - 1 + games.length) % games.length);
    if (event.key === "PageDown" && games.length)
      return move(Math.min(games.length - 1, activeIndex + GAME_PAGE_STEP));
    if (event.key === "PageUp" && games.length)
      return move(Math.max(0, activeIndex - GAME_PAGE_STEP));
    if (event.key === "Home" && games.length) return move(0);
    if (event.key === "End" && games.length) return move(games.length - 1);
    if (event.key === "Enter" && selected) {
      event.preventDefault();
      event.stopPropagation();
      void startGame(selected);
    }
  };

  const clearQuery = () => {
    setQuery("");
    setSelectedGameKey(null);
    inputRef.current?.focus({ preventScroll: true });
  };

  return {
    activeIndex,
    clearQuery,
    favoriteGameKeySet,
    games,
    handleOverlayKeyDown,
    handleSearchKeyDown,
    inputRef,
    itemRefs,
    listRef,
    onQueryChange: (value: string) => {
      setQuery(value);
      setSelectedGameKey(null);
    },
    query,
    searchShortcutModifier,
    selected,
    setSelectedGameKey,
  };
};
