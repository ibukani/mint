import type { GameStore, InstalledGame } from "../types";

export const storeLabel: Record<GameStore, string> = {
  steam: "Steam",
  epic: "Epic Games",
  riot: "Riot Games",
};

export function getAcronym(title: string): string {
  return title
    .split(/[^a-zA-Z0-9]+/)
    .map((word) => word.charAt(0))
    .join("")
    .toLowerCase();
}

export function getArtworkLabel(title: string): string {
  const acronym = getAcronym(title).toUpperCase();
  return acronym.length > 1
    ? acronym.slice(0, 3)
    : title.trim().slice(0, 1).toUpperCase();
}

export const gameDomId = (game: InstalledGame) =>
  `game-launcher-game-${game.store}:${game.id}`.replace(/[^a-zA-Z0-9_-]/g, "-");
