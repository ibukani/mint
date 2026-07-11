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
  hide: vi.fn().mockResolvedValue(undefined),
  launch: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockResolvedValue({ games: [], sources: [] }),
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
    onFocusChanged: vi.fn(
      async (callback: (event: { payload: boolean }) => void) => {
        mocks.focusChanged = callback;
        return () => {
          mocks.focusChanged = undefined;
        };
      },
    ),
  })),
}));

vi.mock("../api", () => ({
  launchGame: mocks.launch,
  listInstalledGames: mocks.list,
}));

const game: InstalledGame = {
  id: "730",
  title: "Counter-Strike 2",
  store: "steam",
  imagePath: null,
};

describe("useGameLauncher lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.listeners.clear();
    mocks.hide.mockClear();
    mocks.launch.mockClear();
    mocks.list.mockClear();
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
});
