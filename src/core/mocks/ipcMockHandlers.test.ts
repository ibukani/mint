import { describe, expect, it, vi } from "vitest";
import { handleGameLauncherIpcCommand } from "./gameLauncherIpcMock";
import {
  createMockDiagnosticsReport,
  handlePerformanceIpcCommand,
} from "./performanceIpcMock";
import { handlePluginIpcCommand } from "./pluginIpcMock";
import { handleSettingsIpcCommand } from "./settingsIpcMock";
import { handleWindowIpcCommand } from "./windowIpcMock";

describe("shared IPC mock handlers", () => {
  it("validates overlay targets and delegates opening", async () => {
    const onOpenOverlay = vi.fn();
    const result = await handleSettingsIpcCommand(
      "open_overlay",
      { target: "clock" },
      {
        load: () => ({}),
        enabledTargets: { clock: true },
        onOpenOverlay,
      },
    );

    expect(result).toEqual({ handled: true, value: undefined });
    expect(onOpenOverlay).toHaveBeenCalledWith("clock");
    await expect(
      handleSettingsIpcCommand(
        "open_overlay",
        { target: "missing" },
        { load: () => ({}), enabledTargets: { clock: true } },
      ),
    ).rejects.toThrow("利用できないオーバーレイです。");
  });

  it("keeps game commands typed while allowing environment-specific behavior", async () => {
    const scanResult = { games: [], sources: [] };
    const onLaunch = vi.fn();
    const result = await handleGameLauncherIpcCommand(
      "launch_game",
      { request: { id: "demo", store: "steam" } },
      { scanResult, onLaunch },
    );

    expect(result).toEqual({ handled: true, value: undefined });
    expect(onLaunch).toHaveBeenCalledWith({ id: "demo", store: "steam" });

    await expect(
      handleGameLauncherIpcCommand(
        "launch_game",
        { request: { id: "demo" } },
        { scanResult },
      ),
    ).rejects.toThrow("Game store is required.");
  });

  it("passes the game scan refresh flag through the browser mock", async () => {
    const scanResult = { games: [], sources: [] };
    const onScan = vi.fn().mockResolvedValue(scanResult);

    await handleGameLauncherIpcCommand(
      "list_installed_games",
      { force: true },
      { scanResult, onScan },
    );

    expect(onScan).toHaveBeenCalledWith(true);
  });

  it("returns lightweight game source counts through the browser mock", async () => {
    const scanResult = {
      games: [
        {
          id: "demo",
          title: "Demo",
          store: "steam" as const,
          imagePath: null,
          fallbackImagePath: null,
        },
      ],
      sources: [{ store: "steam" as const, detected: true, warning: null }],
    };

    const result = await handleGameLauncherIpcCommand(
      "get_game_source_status",
      { force: false },
      { scanResult },
    );

    expect(result).toEqual({
      handled: true,
      value: {
        sources: scanResult.sources,
        gameCounts: { steam: 1, epic: 0, riot: 0 },
      },
    });
  });

  it("passes updater results through the shared plugin handler", async () => {
    const update = { version: "0.2.0" };
    const result = await handlePluginIpcCommand(
      "plugin:updater|check",
      undefined,
      { update },
    );

    expect(result).toEqual({ handled: true, value: update });
  });

  it("acknowledges the overlay readiness handshake", async () => {
    const onOverlayReady = vi.fn();
    const result = await handleWindowIpcCommand("overlay_ready", undefined, {
      onOverlayReady,
    });

    expect(result).toEqual({ handled: true, value: undefined });
    expect(onOverlayReady).toHaveBeenCalledOnce();
  });

  it("forwards settings tab requests to the main window", async () => {
    const onOpenSettingsTab = vi.fn();
    const result = await handleWindowIpcCommand(
      "open_settings_tab",
      { tab: "clock", targetId: "clock-enabled-checkbox" },
      { onOpenSettingsTab },
    );

    expect(result).toEqual({ handled: true, value: undefined });
    expect(onOpenSettingsTab).toHaveBeenCalledWith({
      tab: "clock",
      targetId: "clock-enabled-checkbox",
    });
  });

  it("returns pending settings tab requests for the main window", async () => {
    const onTakePendingSettingsTab = vi
      .fn()
      .mockResolvedValue({ tab: "clock", targetId: null });
    const result = await handleWindowIpcCommand(
      "take_pending_settings_tab",
      undefined,
      { onTakePendingSettingsTab },
    );

    expect(result).toEqual({
      handled: true,
      value: { tab: "clock", targetId: null },
    });
    expect(onTakePendingSettingsTab).toHaveBeenCalledOnce();
  });

  it("serves the diagnostics report from the shared performance handler", async () => {
    const result = await handlePerformanceIpcCommand(
      "collect_diagnostics",
      undefined,
      {},
    );

    expect(result).toEqual({
      handled: true,
      value: createMockDiagnosticsReport(),
    });
    expect(
      (result as { value: { environment: { os: string } } }).value.environment
        .os,
    ).toBe("win32");
  });

  it("returns an unhandled result for unknown performance commands", async () => {
    const result = await handlePerformanceIpcCommand(
      "unknown_performance_command",
      undefined,
      {},
    );

    expect(result).toEqual({ handled: false });
  });
});
