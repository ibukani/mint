import { describe, expect, it, vi } from "vitest";
import { handleGameLauncherIpcCommand } from "./gameLauncherIpcMock";
import { handlePluginIpcCommand } from "./pluginIpcMock";
import { handleSettingsIpcCommand } from "./settingsIpcMock";
import { handleTranscriptionIpcCommand } from "./transcriptionIpcMock";
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
      { request: { id: "demo" } },
      { scanResult, onLaunch },
    );

    expect(result).toEqual({ handled: true, value: undefined });
    expect(onLaunch).toHaveBeenCalledWith("demo");
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

  it("shares transcription validation between browser and Vitest mocks", async () => {
    const result = await handleTranscriptionIpcCommand(
      "transcribe_audio_file",
      {
        audio_file_path: "C:/recording.wav",
        settings: {
          enabled: true,
          baseUrl: "http://localhost:8080",
          model: "mock",
        },
      },
    );

    expect(result).toMatchObject({ handled: true });
    expect((result as { value: { text: string } }).value.text).toContain(
      "C:/recording.wav",
    );
    await expect(
      handleTranscriptionIpcCommand("transcribe_audio_file", {
        audio_file_path: "",
        settings: { enabled: true },
      }),
    ).rejects.toThrow("音声ファイルを選択してください。");
  });

  it("passes updater results through the shared plugin handler", async () => {
    const update = { version: "0.2.0" };
    const result = await handlePluginIpcCommand(
      "plugin:updater|check",
      undefined,
      { update, dialogSave: "/tmp/update.mintbackup" },
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
});
