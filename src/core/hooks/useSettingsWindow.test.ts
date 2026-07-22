import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSettingsWindow } from "./useSettingsWindow";

const windowMocks = vi.hoisted(() => ({
  listen: vi.fn(),
  getCurrentWindow: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: windowMocks.listen,
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: windowMocks.getCurrentWindow,
}));

describe("useSettingsWindow theme handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    windowMocks.getCurrentWindow.mockReturnValue({ label: "main" });
    windowMocks.listen.mockResolvedValue(() => undefined);
    document.documentElement.removeAttribute("data-theme");
  });

  it("follows system appearance changes while system mode is selected", () => {
    let changeListener: (() => void) | undefined;
    const mediaQuery = {
      matches: true,
      addEventListener: vi.fn((_event: string, listener: () => void) => {
        changeListener = listener;
      }),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => mediaQuery),
    );

    const { unmount } = renderHook(() => useSettingsWindow("system"));

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(mediaQuery.addEventListener).toHaveBeenCalledOnce();

    mediaQuery.matches = false;
    changeListener?.();
    expect(document.documentElement.dataset.theme).toBe("dark");

    unmount();
    expect(mediaQuery.removeEventListener).toHaveBeenCalledOnce();
  });

  it("uses the selected fixed theme without subscribing to system changes", () => {
    const matchMedia = vi.fn();
    vi.stubGlobal("matchMedia", matchMedia);

    const { unmount } = renderHook(() => useSettingsWindow("dark"));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(matchMedia).not.toHaveBeenCalled();

    unmount();
  });

  it("falls back to system preference when theme is undefined (loading state)", () => {
    const mediaQuery = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => mediaQuery),
    );

    const { unmount } = renderHook(() => useSettingsWindow(undefined));

    expect(document.documentElement.dataset.theme).toBe("light");

    unmount();
  });

  it("records a focus target when navigating to an individual setting", () => {
    const { result } = renderHook(() => useSettingsWindow("dark"));

    act(() => {
      result.current.setActiveTab("voiceToText", "v2t-api-key-input");
    });

    expect(result.current.activeTab).toBe("voiceToText");
    expect(result.current.focusRequest).toEqual({
      id: 1,
      targetId: "v2t-api-key-input",
    });
  });
});
