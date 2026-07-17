import React, { useState } from "react";
import type { InstalledGame } from "../types";
import { getArtworkLabel } from "./gameLauncherPresentation";

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
