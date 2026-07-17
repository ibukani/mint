import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  destroy: vi.fn().mockResolvedValue(undefined),
  isVisible: vi.fn().mockResolvedValue(false),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    destroy: mocks.destroy,
    isVisible: mocks.isVisible,
  })),
}));

import {
  OVERLAY_IDLE_EVICTION_MS,
  useOverlayWindowEviction,
} from "./useOverlayWindowEviction";

describe("useOverlayWindowEviction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.destroy.mockClear();
    mocks.isVisible.mockReset().mockResolvedValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("非表示の補助ウィンドウをアイドル猶予後に破棄する", async () => {
    renderHook(({ isVisible }) => useOverlayWindowEviction(isVisible), {
      initialProps: { isVisible: false },
    });

    act(() => {
      vi.advanceTimersByTime(OVERLAY_IDLE_EVICTION_MS - 1);
    });
    expect(mocks.destroy).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(mocks.isVisible).toHaveBeenCalledOnce();
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });

  it("猶予中に再表示されたウィンドウは破棄しない", async () => {
    const { rerender } = renderHook(
      ({ isVisible }) => useOverlayWindowEviction(isVisible),
      { initialProps: { isVisible: false } },
    );

    rerender({ isVisible: true });
    await act(async () => {
      vi.advanceTimersByTime(OVERLAY_IDLE_EVICTION_MS);
      await Promise.resolve();
    });
    expect(mocks.isVisible).not.toHaveBeenCalled();
    expect(mocks.destroy).not.toHaveBeenCalled();
  });

  it("OS側で表示中なら破棄しない", async () => {
    mocks.isVisible.mockResolvedValue(true);
    renderHook(() => useOverlayWindowEviction(false));

    await act(async () => {
      vi.advanceTimersByTime(OVERLAY_IDLE_EVICTION_MS);
      await Promise.resolve();
    });
    expect(mocks.isVisible).toHaveBeenCalledOnce();
    expect(mocks.destroy).not.toHaveBeenCalled();
  });
});
