import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppSettingsProvider } from "../../../core/context/AppSettings";
import type { InstalledGame } from "../types";
import { useGameLauncher } from "./useGameLauncher";

const mocks = vi.hoisted(() => ({
  listeners: new Map<string, () => void>(),
  focusChanged: undefined as
    | ((event: { payload: boolean }) => void)
    | undefined,
  closeRequested: undefined as (() => void) | undefined,
  hide: vi.fn().mockResolvedValue(undefined),
  launch: vi.fn().mockResolvedValue(undefined),
  openStore: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockResolvedValue({ games: [], sources: [] }),
  checkVisibility: false,
  windowVisible: true,
  isVisible: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (event: string, callback: () => void) => {
    mocks.listeners.set(event, callback);
    return () => mocks.listeners.delete(event);
  }),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    hide: mocks.hide,
    ...(mocks.checkVisibility ? { isVisible: mocks.isVisible } : {}),
    onFocusChanged: vi.fn(
      async (callback: (event: { payload: boolean }) => void) => {
        mocks.focusChanged = callback;
        return () => {
          mocks.focusChanged = undefined;
        };
      },
    ),
    onCloseRequested: vi.fn(async (callback: () => void) => {
      mocks.closeRequested = callback;
      return () => {
        mocks.closeRequested = undefined;
      };
    }),
  })),
}));

vi.mock("../api", () => ({
  launchGame: mocks.launch,
  listInstalledGames: mocks.list,
  openGameStorePage: mocks.openStore,
}));

const game: InstalledGame = {
  id: "730",
  title: "Counter-Strike 2",
  store: "steam",
  imagePath: null,
  fallbackImagePath: null,
};

describe("useGameLauncher lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.listeners.clear();
    mocks.hide.mockClear();
    mocks.launch.mockClear();
    mocks.openStore.mockClear();
    mocks.list.mockClear();
    mocks.closeRequested = undefined;
    mocks.checkVisibility = false;
    mocks.windowVisible = true;
    mocks.isVisible
      .mockReset()
      .mockImplementation(() => Promise.resolve(mocks.windowVisible));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("閉じる処理とフォーカス喪失が重なってもhideを一度だけ実行する", async () => {
    const { result } = renderHook(() => useGameLauncher(), {
      wrapper: AppSettingsProvider,
    });
    act(() => {
      result.current.close();
      mocks.focusChanged?.({ payload: false });
      vi.advanceTimersByTime(180);
    });
    await act(async () => Promise.resolve());
    expect(mocks.hide).toHaveBeenCalledOnce();
  });

  it("ネイティブのclose要求でも表示状態と結果を解放する", async () => {
    const { result } = renderHook(() => useGameLauncher(), {
      wrapper: AppSettingsProvider,
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.result).not.toBeNull();

    act(() => {
      mocks.closeRequested?.();
      vi.advanceTimersByTime(180);
    });
    await act(async () => Promise.resolve());

    expect(result.current.result).toBeNull();
    expect(result.current.animationClass).toBe("");
  });

  it("閉じた後のshownイベントで古いtimerを破棄して再び操作できる", async () => {
    const { result } = renderHook(() => useGameLauncher(), {
      wrapper: AppSettingsProvider,
    });
    const initialSequence = result.current.showSequence;
    act(() => {
      result.current.close();
      mocks.listeners.get("game-launcher-shown")?.();
      vi.advanceTimersByTime(180);
    });
    await act(async () => Promise.resolve());
    expect(mocks.hide).not.toHaveBeenCalled();
    expect(result.current.animationClass).toBe("is-visible");
    expect(result.current.showSequence).toBe(initialSequence + 1);
  });

  it("非表示の生成直後はゲームを走査せず、表示時に初回走査する", async () => {
    mocks.checkVisibility = true;
    mocks.windowVisible = false;
    const { result } = renderHook(() => useGameLauncher(), {
      wrapper: AppSettingsProvider,
    });
    const showLauncher = mocks.listeners.get("game-launcher-shown");

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.list).not.toHaveBeenCalled();
    expect(result.current.result).toBeNull();

    mocks.windowVisible = true;
    act(() => showLauncher?.());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.list).toHaveBeenCalledOnce();
  });

  it("非表示時にスキャン結果を解放し、再表示時に再取得する", async () => {
    mocks.list.mockResolvedValue({ games: [game], sources: [] });
    const { result } = renderHook(() => useGameLauncher(), {
      wrapper: AppSettingsProvider,
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.result?.games).toHaveLength(1);

    act(() => mocks.listeners.get("game-launcher-shown")?.());
    act(() => {
      result.current.close();
      vi.advanceTimersByTime(180);
    });
    await act(async () => Promise.resolve());
    expect(result.current.result).toBeNull();

    act(() => mocks.listeners.get("game-launcher-shown")?.());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.result?.games).toHaveLength(1);
    expect(mocks.list).toHaveBeenCalledTimes(2);
  });

  it("起動要求を処理中は重複起動を拒否する", async () => {
    const { result } = renderHook(() => useGameLauncher(), {
      wrapper: AppSettingsProvider,
    });
    await act(async () => {
      await Promise.all([
        result.current.startGame(game),
        result.current.startGame(game),
      ]);
    });
    expect(mocks.launch).toHaveBeenCalledOnce();
  });

  it("管理画面を開いてもゲームは起動しない", async () => {
    const { result } = renderHook(() => useGameLauncher(), {
      wrapper: AppSettingsProvider,
    });
    await act(async () => {
      await result.current.openStorePage(game);
    });
    expect(mocks.openStore).toHaveBeenCalledWith({ id: "730", store: "steam" });
    expect(mocks.launch).not.toHaveBeenCalled();
  });
});
