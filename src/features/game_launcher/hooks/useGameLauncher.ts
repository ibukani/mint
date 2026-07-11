import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import { launchGame, listInstalledGames } from "../api";
import type { GameScanResult, InstalledGame } from "../types";

const HIDE_ANIMATION_MS = 180;

export const useGameLauncher = () => {
  const [result, setResult] = useState<GameScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  const [hiding, setHiding] = useState(false);
  const [showSequence, setShowSequence] = useState(0);
  const scanSequence = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingRef = useRef(false);
  const launchingRef = useRef(false);

  const scan = useCallback(async () => {
    const sequence = ++scanSequence.current;
    setLoading(true);
    setError(null);
    try {
      const next = await listInstalledGames();
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
    setVisible(false);
    setHiding(true);
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    hideTimer.current = setTimeout(
      () => {
        void getCurrentWindow()
          .hide()
          .finally(() => {
            hideTimer.current = null;
            setHiding(false);
          });
      },
      reduceMotion ? 0 : HIDE_ANIMATION_MS,
    );
  }, []);

  const startGame = useCallback(
    async (game: InstalledGame) => {
      if (launchingRef.current || closingRef.current) return;
      launchingRef.current = true;
      setLaunchingId(game.id);
      setError(null);
      try {
        await launchGame({ id: game.id, store: game.store });
        close();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        launchingRef.current = false;
        setLaunchingId(null);
      }
    },
    [close],
  );

  useEffect(() => {
    document.body.classList.add("is-overlay");
    document.documentElement.classList.add("is-overlay");
    void scan();
    const shown = listen("game-launcher-shown", () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      closingRef.current = false;
      setHiding(false);
      setVisible(true);
      setShowSequence((current) => current + 1);
      void scan();
    });
    const hide = listen("game-launcher-hide-requested", close);
    const currentWindow = getCurrentWindow();
    const focus = currentWindow.onFocusChanged(({ payload }) => {
      if (!payload && !closingRef.current) close();
    });
    return () => {
      document.body.classList.remove("is-overlay");
      document.documentElement.classList.remove("is-overlay");
      if (hideTimer.current) clearTimeout(hideTimer.current);
      void shown.then((unlisten) => unlisten());
      void hide.then((unlisten) => unlisten());
      void focus.then((unlisten) => unlisten());
    };
  }, [close, scan]);

  return {
    animationClass: hiding ? "is-hiding" : visible ? "is-visible" : "",
    close,
    error,
    launchingId,
    loading,
    result,
    scan,
    showSequence,
    startGame,
  };
};
