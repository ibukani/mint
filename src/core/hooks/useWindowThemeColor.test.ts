import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { defaultAppSettings } from "../defaultSettings";
import { createMockSettings } from "../mocks/mockSettings";
import { getWindowThemeColor, WINDOW_ROUTES } from "../windowRoutes";
import { useWindowThemeColor } from "./useWindowThemeColor";

describe("useWindowThemeColor", () => {
  beforeEach(() => {
    document.documentElement.style.removeProperty("--color-accent");
  });

  it("applies the routed window accent to the document root", () => {
    const settings = createMockSettings({
      quickCapture: {
        ...defaultAppSettings.quickCapture,
        themeColor: "#123456",
      },
    });

    const { unmount } = renderHook(() =>
      useWindowThemeColor("quickCapture", settings),
    );

    expect(
      document.documentElement.style.getPropertyValue("--color-accent"),
    ).toBe("#123456");

    unmount();
    expect(
      document.documentElement.style.getPropertyValue("--color-accent"),
    ).toBe("");
  });

  it("uses the owning feature color for auxiliary windows", () => {
    const settings = createMockSettings({
      calendar: {
        ...defaultAppSettings.calendar,
        themeColor: "#abcdef",
      },
    });

    renderHook(() => useWindowThemeColor("calendarEditor", settings));

    expect(
      document.documentElement.style.getPropertyValue("--color-accent"),
    ).toBe("#abcdef");
  });

  it("maps every non-settings window to its owning feature color", () => {
    const settings = createMockSettings({
      clock: { ...defaultAppSettings.clock, themeColor: "#100001" },
      calendar: { ...defaultAppSettings.calendar, themeColor: "#100002" },
      gameLauncher: {
        ...defaultAppSettings.gameLauncher,
        themeColor: "#100003",
      },
      quickCapture: {
        ...defaultAppSettings.quickCapture,
        themeColor: "#100004",
      },
      fileShelf: { ...defaultAppSettings.fileShelf, themeColor: "#100005" },
    });

    expect(Object.keys(WINDOW_ROUTES)).toEqual([
      "clock",
      "calendar",
      "calendarEditor",
      "gameLauncher",
      "quickCapture",
      "fileShelf",
    ]);
    expect(getWindowThemeColor("clock", settings)).toBe("#100001");
    expect(getWindowThemeColor("calendar", settings)).toBe("#100002");
    expect(getWindowThemeColor("calendarEditor", settings)).toBe("#100002");
    expect(getWindowThemeColor("gameLauncher", settings)).toBe("#100003");
    expect(getWindowThemeColor("quickCapture", settings)).toBe("#100004");
    expect(getWindowThemeColor("fileShelf", settings)).toBe("#100005");
  });

  it("falls back to defaults until settings are available", () => {
    renderHook(() => useWindowThemeColor("fileShelf", null));

    expect(
      document.documentElement.style.getPropertyValue("--color-accent"),
    ).toBe(defaultAppSettings.fileShelf.themeColor);
  });

  it("does not override the settings window accent", () => {
    document.documentElement.style.setProperty("--color-accent", "#123456");

    renderHook(() => useWindowThemeColor("main", createMockSettings()));

    expect(
      document.documentElement.style.getPropertyValue("--color-accent"),
    ).toBe("");
  });
});
