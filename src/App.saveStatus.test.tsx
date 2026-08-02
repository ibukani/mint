import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { createMockSettings } from "./core/mocks/mockSettings";

const eventMocks = vi.hoisted(() => ({
  listeners: new Map<string, () => void | Promise<void>>(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (event: string, handler: () => void | Promise<void>) => {
    eventMocks.listeners.set(event, handler);
    return () => eventMocks.listeners.delete(event);
  }),
}));

vi.mock("@tauri-apps/api/window", () => ({
  Window: {
    getByLabel: vi.fn().mockResolvedValue(null),
  },
  getCurrentWindow: vi.fn(() => ({
    label: "main",
    hide: vi.fn().mockResolvedValue(undefined),
    show: vi.fn().mockResolvedValue(undefined),
  })),
  currentMonitor: vi.fn().mockResolvedValue({
    size: { width: 1920, height: 1080 },
    scaleFactor: 1,
  }),
}));

// Replace the lazy ClockSettings tab with a render-counting wrapper so the
// test can assert that save-status transitions do not re-render feature
// settings components (Issue #31 acceptance criterion).
vi.mock("./features/clock/components/ClockSettings", async () => {
  const { useRef } = await import("react");
  const { useUpdateSettings } = await import("./core/context/AppSettings");
  const CountingClockSettings: React.FC = () => {
    const renderCount = useRef(0);
    renderCount.current += 1;
    const updateSettings = useUpdateSettings();
    return (
      <div>
        <span data-testid="clock-render-count">{renderCount.current}</span>
        <button
          type="button"
          data-testid="toggle-clock"
          onClick={() =>
            updateSettings((previous) => ({
              ...previous,
              clock: {
                ...previous.clock,
                enabled: !previous.clock.enabled,
              },
            }))
          }
        >
          時計を切り替え
        </button>
      </div>
    );
  };
  return { ClockSettings: CountingClockSettings };
});

describe("App save-status render isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventMocks.listeners.clear();
    window.localStorage.clear();
    vi.mocked(getCurrentWindow).mockReturnValue({
      label: "main",
      hide: vi.fn().mockResolvedValue(undefined),
      show: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof getCurrentWindow>);
  });

  it("does not re-render the feature settings component on save-status transitions", async () => {
    window.localStorage.setItem("mint.active-settings-tab", "clock");
    vi.mocked(invoke).mockImplementation(async (command: string) => {
      if (command === "load_settings") return createMockSettings();
      if (command === "save_settings") return undefined;
      return undefined;
    });

    render(<App />);

    // The feature component mounts once settings are loaded.
    const countEl = await screen.findByTestId("clock-render-count");
    expect(countEl).toHaveTextContent("1");

    fireEvent.click(screen.getByTestId("toggle-clock"));

    // Wait for the save-status UI to reflect a completed save.
    expect(await screen.findByText("保存完了")).toBeInTheDocument();
    // Sidebar footer reflects the saved tone via its own subscription.
    expect(screen.getByText("保存済み")).toBeInTheDocument();

    // The settings change itself may re-render the feature once (settings
    // slice changed), but the pending → saving → saved transitions must not
    // add renders on top of it.
    expect(countEl).toHaveTextContent("2");
  });
});
