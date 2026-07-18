import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppSettings } from "../../../core/context/AppSettings";
import { defaultAppSettings } from "../../../core/defaultSettings";
import { useOverlayWindowEviction } from "../../../core/hooks/useOverlayWindowEviction";
import { useOverlayWindowReady } from "../../../core/hooks/useOverlayWindowReady";
import { launchGame, listInstalledGames, openGameStorePage } from "../api";
import { type GameScanResult, gameKey, type InstalledGame } from "../types";

const HIDE_ANIMATION_MS = 180;

export const useGameLauncher = () => {
  const { settings, updateSettings } = useAppSettings();
  const [result, setResult] = useState<GameScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [launchingGameKey, setLaunchingGameKey] = useState<string | null>(null);
  const [openingStoreId, setOpeningStoreId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [hiding, setHiding] = useState(false);
  const [showSequence, setShowSequence] = useState(0);
  const scanSequence = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingRef = useRef(false);
  const visibleRef = useRef(false);
  const launchingRef = useRef(false);
  const initialScanStartedRef = useRef(false);
  const initialShownRef = useRef(false);

  const scan = useCallback(async (force = false) => {
    const sequence = ++scanSequence.current;
    setLoading(true);
    setError(null);
    try {
      const next = await listInstalledGames(force);
      if (sequence === scanSequence.current) setResult(next);
    } catch (reason) {
      if (sequence === scanSequence.current) {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    } finally {
      if (sequence === scanSequence.current) setLoading(false);
    }
  }, []);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    scanSequence.current += 1;
    visibleRef.current = false;
    setVisible(false);
    setHiding(true);
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    hideTimer.current = setTimeout(
      () => {
        void getCurrentWindow()
          .hide()
          .then(() => {
            setResult(null);
          })
          .catch((error) => {
            console.error("Failed to hide game launcher window:", error);
          })
          .finally(() => {
            hideTimer.current = null;
            setHiding(false);
            closingRef.current = false;
          });
      },
      reduceMotion ? 0 : HIDE_ANIMATION_MS,
    );
  }, []);

  const startGame = useCallback(
    async (game: InstalledGame) => {
      if (launchingRef.current || closingRef.current) return;
      launchingRef.current = true;
      setLaunchingGameKey(gameKey(game));
      setError(null);
      try {
        await launchGame({ id: game.id, store: game.store });
        const playedAt = new Date().toISOString();
        const key = gameKey(game);
        updateSettings((previous) => ({
          ...previous,
          gameLauncher: {
            ...previous.gameLauncher,
            lastPlayedAtByGame: {
              ...previous.gameLauncher.lastPlayedAtByGame,
              [key]: playedAt,
            },
          },
        }));
        close();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        launchingRef.current = false;
        setLaunchingGameKey(null);
      }
    },
    [close, updateSettings],
  );

  const openStorePage = useCallback(async (game: InstalledGame) => {
    setOpeningStoreId(gameKey(game));
    setError(null);
    try {
      await openGameStorePage({ id: game.id, store: game.store });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setOpeningStoreId(null);
    }
  }, []);

  const toggleFavorite = useCallback(
    (game: InstalledGame) => {
      const key = gameKey(game);
      updateSettings((previous) => {
        const favorites = previous.gameLauncher.favoriteGameKeys;
        const favoriteGameKeys = favorites.includes(key)
          ? favorites.filter((favorite) => favorite !== key)
          : [...favorites, key];
        return {
          ...previous,
          gameLauncher: { ...previous.gameLauncher, favoriteGameKeys },
        };
      });
    },
    [updateSettings],
  );

  useEffect(() => {
    let mounted = true;
    document.body.classList.add("is-overlay");
    document.documentElement.classList.add("is-overlay");
    const currentWindow = getCurrentWindow();
    const startInitialScan = () => {
      if (initialScanStartedRef.current) return;
      initialScanStartedRef.current = true;
      void scan();
    };
    const assumeVisibleAndScan = () => {
      if (!mounted) return;
      visibleRef.current = true;
      setVisible(true);
      startInitialScan();
    };

    if (typeof currentWindow.isVisible !== "function") {
      assumeVisibleAndScan();
    } else {
      void currentWindow
        .isVisible()
        .then((isWindowVisible) => {
          if (!mounted || isWindowVisible === false) return;
          assumeVisibleAndScan();
        })
        .catch(assumeVisibleAndScan);
    }

    const shown = listen("game-launcher-shown", () => {
      const firstShown = !initialShownRef.current;
      initialShownRef.current = true;
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      closingRef.current = false;
      visibleRef.current = true;
      setHiding(false);
      setVisible(true);
      setShowSequence((current) => current + 1);
      if (!initialScanStartedRef.current) startInitialScan();
      else if (!firstShown) void scan();
    });
    const hide = listen("game-launcher-hide-requested", close);
    const focus = currentWindow.onFocusChanged(({ payload }) => {
      if (!payload && !closingRef.current && visibleRef.current) close();
    });
    const closeRequested =
      typeof currentWindow.onCloseRequested === "function"
        ? currentWindow.onCloseRequested(() => close())
        : null;
    return () => {
      mounted = false;
      document.body.classList.remove("is-overlay");
      document.documentElement.classList.remove("is-overlay");
      if (hideTimer.current) clearTimeout(hideTimer.current);
      void shown.then((unlisten) => unlisten());
      void hide.then((unlisten) => unlisten());
      void focus.then((unlisten) => unlisten());
      if (closeRequested) {
        void closeRequested.then((unlisten) => unlisten());
      }
    };
  }, [close, scan]);

  useOverlayWindowEviction(visible);
  useOverlayWindowReady();

  return {
    animationClass: hiding ? "is-hiding" : visible ? "is-visible" : "",
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
    favoriteGameKeys:
      settings?.gameLauncher.favoriteGameKeys ??
      defaultAppSettings.gameLauncher.favoriteGameKeys,
    lastPlayedAtByGame:
      settings?.gameLauncher.lastPlayedAtByGame ??
      defaultAppSettings.gameLauncher.lastPlayedAtByGame,
  };
};
