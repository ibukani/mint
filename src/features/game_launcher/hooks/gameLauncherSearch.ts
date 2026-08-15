import { getAcronym, storeLabel } from "../components/gameLauncherPresentation";
import type { InstalledGame } from "../types";

const STORE_SEARCH_ALIASES = {
  steam: ["steam", "スチーム"],
  epic: ["epic", "epic games", "エピック", "エピックゲームズ"],
  riot: ["riot", "riot games", "ライオット", "ライオットゲームズ"],
} as const;

export const normalizeGameSearchText = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("ja")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const compact = (value: string) => value.replace(/\s+/g, "");

export interface SearchableGame {
  game: InstalledGame;
  key: string;
  title: string;
  compactTitle: string;
  acronym: string;
  searchText: string;
  lastPlayedAt: number;
}

export const createSearchableGame = (
  game: InstalledGame,
  key: string,
  lastPlayedAt: number,
): SearchableGame => {
  const title = normalizeGameSearchText(game.title);
  const acronym = normalizeGameSearchText(getAcronym(game.title));
  const storeTerms = [
    storeLabel[game.store],
    ...STORE_SEARCH_ALIASES[game.store],
  ]
    .map(normalizeGameSearchText)
    .join(" ");
  return {
    game,
    key,
    title,
    compactTitle: compact(title),
    acronym,
    searchText: `${title} ${compact(title)} ${acronym} ${storeTerms}`,
    lastPlayedAt,
  };
};

export const getGameSearchScore = (
  searchable: SearchableGame,
  query: string,
): number | null => {
  const normalizedQuery = normalizeGameSearchText(query);
  if (!normalizedQuery) return 0;
  const terms = normalizedQuery.split(" ");
  if (!terms.every((term) => searchable.searchText.includes(term))) return null;

  const compactQuery = compact(normalizedQuery);
  if (searchable.title === normalizedQuery) return 0;
  if (searchable.title.startsWith(normalizedQuery)) return 10;
  if (searchable.acronym === compactQuery) return 20;
  if (
    terms.every(
      (term) =>
        searchable.title.includes(term) ||
        searchable.compactTitle.includes(term),
    )
  ) {
    return 30;
  }
  return 40;
};
