import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isApplePlatform,
  revealElementVertically,
} from "../../../design/layout";
import type { GameScanResult, InstalledGame } from "../types";
import { gameKey } from "../types";
import { createSearchableGame, getGameSearchScore } from "./gameLauncherSearch";

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
        return createSearchableGame(
          game,
          key,
          Date.parse(lastPlayedAtByGame[key] ?? "") || 0,
        );
      }),
    [lastPlayedAtByGame, result],
  );
  const favoriteGameKeySet = useMemo(
    () => new Set(favoriteGameKeys),
    [favoriteGameKeys],
  );
  const compareGames = useCallback(
    (
      left: (typeof searchableGames)[number],
      right: (typeof searchableGames)[number],
    ) => {
      const favoriteDifference =
        Number(favoriteGameKeySet.has(right.key)) -
        Number(favoriteGameKeySet.has(left.key));
      return (
        favoriteDifference ||
        right.lastPlayedAt - left.lastPlayedAt ||
        left.game.title.localeCompare(right.game.title, "ja")
      );
    },
    [favoriteGameKeySet],
  );
  const orderedGames = useMemo(
    () => [...searchableGames].sort(compareGames),
    [compareGames, searchableGames],
  );
  const games = useMemo(() => {
    if (!query.trim()) return orderedGames.map(({ game }) => game);
    return orderedGames
      .map((searchable) => ({
        searchable,
        score: getGameSearchScore(searchable, query),
      }))
      .filter(
        (
          match,
        ): match is {
          searchable: (typeof orderedGames)[number];
          score: number;
        } => match.score !== null,
      )
      .sort(
        (left, right) =>
          left.score - right.score ||
          compareGames(left.searchable, right.searchable),
      )
      .map(({ searchable }) => searchable.game);
  }, [compareGames, orderedGames, query]);
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
    if (event.nativeEvent.isComposing) return;
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
