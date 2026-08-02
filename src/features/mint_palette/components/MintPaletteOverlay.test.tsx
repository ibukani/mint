import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSettings } from "../../../core/mocks/mockSettings";
import type { AppSettings } from "../../../core/settingsModel";
import { MintPaletteOverlay } from "./MintPaletteOverlay";

const eventMocks = vi.hoisted(() => ({
  listeners: new Map<string, () => void>(),
  listen: vi.fn(async (event: string, callback: () => void) => {
    eventMocks.listeners.set(event, callback);
    return () => eventMocks.listeners.delete(event);
  }),
}));

const windowMocks = vi.hoisted(() => ({
  isVisible: vi.fn(),
  hide: vi.fn(),
  getCurrentWindow: vi.fn(),
}));

const settingsMocks = vi.hoisted(() => ({
  updateSettings: vi.fn(),
  useSettings: vi.fn(),
}));

const coreMocks = vi.hoisted(() => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: eventMocks.listen,
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: windowMocks.getCurrentWindow,
}));

vi.mock("../../../core/context/AppSettings", () => ({
  useSettings: settingsMocks.useSettings,
  useUpdateSettings: () => settingsMocks.updateSettings,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: coreMocks.invoke,
}));

const renderOverlay = (settings: AppSettings | null = createMockSettings()) => {
  settingsMocks.useSettings.mockReturnValue(settings);
  windowMocks.getCurrentWindow.mockReturnValue({
    isVisible: windowMocks.isVisible,
    hide: windowMocks.hide,
  });
  return render(<MintPaletteOverlay />);
};

describe("MintPaletteOverlay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    windowMocks.isVisible.mockResolvedValue(true);
    windowMocks.hide.mockResolvedValue(undefined);
    Element.prototype.scrollIntoView =
      vi.fn() as unknown as typeof Element.prototype.scrollIntoView;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    eventMocks.listeners.clear();
    windowMocks.isVisible.mockClear();
    windowMocks.hide.mockClear();
    settingsMocks.updateSettings.mockClear();
    coreMocks.invoke.mockClear();
  });

  it("renders a searchable palette with all actions", async () => {
    renderOverlay();
    await act(async () => {});

    const input = screen.getByRole("combobox", { name: "操作や設定を検索" });
    expect(input).toBeInTheDocument();
    expect(
      screen.getByRole("listbox", { name: "操作・設定を選択" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
  });

  it("filters results while typing", async () => {
    renderOverlay();
    await act(async () => {});

    const input = screen.getByRole("combobox", { name: "操作や設定を検索" });
    fireEvent.change(input, { target: { value: "ダークテーマ" } });

    expect(
      screen.queryByRole("option", { name: /時計オーバーレイを開く/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("ダークテーマにする")).toBeInTheDocument();
  });

  it("moves the active option with arrow keys", async () => {
    renderOverlay();
    await act(async () => {});

    const input = screen.getByRole("combobox", { name: "操作や設定を検索" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });

    const options = screen.getAllByRole("option");
    expect(options[2]).toHaveAttribute("aria-selected", "true");
    expect(options[0]).toHaveAttribute("aria-selected", "false");
  });

  it("executes the active action on Enter and hides the window", async () => {
    renderOverlay();
    await act(async () => {});

    const input = screen.getByRole("combobox", { name: "操作や設定を検索" });
    fireEvent.change(input, { target: { value: "ダークテーマ" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(settingsMocks.updateSettings).toHaveBeenCalledWith({
      theme: "dark",
    });
    expect(windowMocks.hide).not.toHaveBeenCalled();

    await act(async () => {});
    act(() => vi.advanceTimersByTime(220));
    expect(windowMocks.hide).toHaveBeenCalledOnce();

    expect(
      localStorage.getItem("mint.settings-quick-switcher.recent-results"),
    ).toContain("action:set-theme-dark");
  });

  it("ignores Enter while the IME is composing", async () => {
    renderOverlay();
    await act(async () => {});

    const input = screen.getByRole("combobox", { name: "操作や設定を検索" });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });

    expect(settingsMocks.updateSettings).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(220));
    expect(windowMocks.hide).not.toHaveBeenCalled();
  });

  it("hides the window on Escape", async () => {
    renderOverlay();
    await act(async () => {});

    const input = screen.getByRole("combobox", { name: "操作や設定を検索" });
    fireEvent.keyDown(input, { key: "Escape" });

    act(() => vi.advanceTimersByTime(220));
    expect(windowMocks.hide).toHaveBeenCalledOnce();
  });

  it("shows an alert for disabled actions instead of hiding", async () => {
    const clockDisabledSettings = createMockSettings({
      clock: { ...createMockSettings().clock, enabled: false },
    });
    renderOverlay(clockDisabledSettings);
    await act(async () => {});

    const input = screen.getByRole("combobox", { name: "操作や設定を検索" });
    fireEvent.change(input, { target: { value: "時計を開く" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await act(async () => {});

    expect(screen.getByRole("alert")).toHaveTextContent(
      "時計オーバーレイが無効です。詳細設定で有効にしてください。",
    );
    expect(
      screen.getByRole("button", { name: "詳細設定を開く" }),
    ).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(220));
    expect(windowMocks.hide).not.toHaveBeenCalled();
  });

  it("opens the feature settings tab from a disabled action", async () => {
    const clockDisabledSettings = createMockSettings({
      clock: { ...createMockSettings().clock, enabled: false },
    });
    renderOverlay(clockDisabledSettings);
    await act(async () => {});

    const input = screen.getByRole("combobox", { name: "操作や設定を検索" });
    fireEvent.change(input, { target: { value: "時計を開く" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "詳細設定を開く" }));

    expect(coreMocks.invoke).toHaveBeenCalledWith("open_settings_tab", {
      tab: "clock",
      targetId: "clock-enabled-checkbox",
    });
  });

  it("resets the query when the window is shown again", async () => {
    renderOverlay();
    await act(async () => {});

    const input = screen.getByRole("combobox", { name: "操作や設定を検索" });
    fireEvent.change(input, { target: { value: "ダーク" } });
    expect(input).toHaveValue("ダーク");

    const showListener = eventMocks.listeners.get("mint-palette-shown");
    expect(showListener).toBeDefined();
    act(() => showListener?.());
    expect(input).toHaveValue("");
  });
});
