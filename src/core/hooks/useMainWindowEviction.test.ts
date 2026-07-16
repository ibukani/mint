import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMainWindowEviction } from "./useMainWindowEviction";
import { OVERLAY_IDLE_EVICTION_MS } from "./useOverlayWindowEviction";

const mocks = vi.hoisted(() => ({
  isVisible: vi.fn().mockResolvedValue(true),
  onCloseRequested: vi.fn(),
  listeners: new Map<string, () => void>(),
  destroy: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (event: string, callback: () => void) => {
    mocks.listeners.set(event, callback);
    return () => mocks.listeners.delete(event);
  }),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    destroy: mocks.destroy,
    isVisible: mocks.isVisible,
    onCloseRequested: mocks.onCloseRequested,
  })),
}));

describe("useMainWindowEviction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.isVisible.mockReset().mockResolvedValue(true);
    mocks.onCloseRequested.mockReset().mockResolvedValue(() => undefined);
    mocks.listeners.clear();
    mocks.destroy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("メイン画面の終了要求後にアイドル破棄を予約する", async () => {
    renderHook(() => useMainWindowEviction(true));
    await act(async () => Promise.resolve());

    const closeCallback = mocks.onCloseRequested.mock.calls[0]?.[0] as
      | (() => void)
      | undefined;
    act(() => closeCallback?.());
    mocks.isVisible.mockResolvedValue(false);

    await act(async () => {
      vi.advanceTimersByTime(OVERLAY_IDLE_EVICTION_MS);
      await Promise.resolve();
    });
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });

  it("メイン画面以外では終了監視と破棄を行わない", async () => {
    renderHook(() => useMainWindowEviction(false));
    await act(async () => {
      vi.advanceTimersByTime(OVERLAY_IDLE_EVICTION_MS);
      await Promise.resolve();
    });
    expect(mocks.onCloseRequested).not.toHaveBeenCalled();
    expect(mocks.destroy).not.toHaveBeenCalled();
  });
});
