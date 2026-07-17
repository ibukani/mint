import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSettings } from "../../../core/mocks/mockSettings";
import { useClockOverlay } from "./useClockOverlay";

const mocks = vi.hoisted(() => ({
  listeners: new Map<
    string,
    (event?: { payload?: { hideClock?: boolean } }) => void
  >(),
  hide: vi.fn().mockResolvedValue(undefined),
  checkVisibility: false,
  windowVisible: true,
  isVisible: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(
    async (
      event: string,
      callback: (event?: { payload?: { hideClock?: boolean } }) => void,
    ) => {
      mocks.listeners.set(event, callback);
      return () => mocks.listeners.delete(event);
    },
  ),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    hide: mocks.hide,
    ...(mocks.checkVisibility ? { isVisible: mocks.isVisible } : {}),
  })),
}));

vi.mock("../../../core/context/AppSettings", () => ({
  useAppSettings: () => ({ settings: createMockSettings() }),
}));

describe("useClockOverlay", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.useFakeTimers();
    mocks.listeners.clear();
    mocks.hide.mockClear();
    mocks.checkVisibility = false;
    mocks.windowVisible = true;
    mocks.isVisible
      .mockReset()
      .mockImplementation(() => Promise.resolve(mocks.windowVisible));
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.useRealTimers();
  });

  it("hides immediately when reduced motion is enabled", async () => {
    const { result } = renderHook(() => useClockOverlay());

    act(() => result.current.hideClock());
    expect(result.current.animationClass).toBe("is-hiding");

    act(() => vi.advanceTimersByTime(0));
    await act(async () => Promise.resolve());

    expect(mocks.hide).toHaveBeenCalledOnce();
  });

  it("stops ticking when the calendar closes its clock", () => {
    const { result } = renderHook(() => useClockOverlay());

    act(() => {
      mocks.listeners.get("calendar-closed")?.({
        payload: { hideClock: true },
      });
    });

    expect(result.current.isAnimateVisible).toBe(false);
    expect(result.current.isHiding).toBe(false);
  });

  it("does not start clock updates while the newly created window is hidden", async () => {
    mocks.checkVisibility = true;
    mocks.windowVisible = false;
    const { result } = renderHook(() => useClockOverlay());
    const showClock = mocks.listeners.get("clock-shown");

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.isAnimateVisible).toBe(false);

    mocks.windowVisible = true;
    act(() => showClock?.());
    expect(result.current.isAnimateVisible).toBe(true);
  });

  it("does not restart the auto-hide countdown for an unrelated settings rerender", async () => {
    const { rerender } = renderHook(() => useClockOverlay());

    act(() => vi.advanceTimersByTime(2_500));
    rerender();
    act(() => vi.advanceTimersByTime(500));
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    expect(mocks.hide).toHaveBeenCalledOnce();
  });
});
