import { type InvokeArgs, invoke } from "@tauri-apps/api/core";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppSettingsProvider } from "../../../core/context/AppSettings";
import { VoiceToTextSettings } from "./VoiceToTextSettings";

// Mock invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("VoiceToTextSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads api key on mount and saves api key on blur", async () => {
    const mockSettings = {
      theme: "dark",
      clock: { shortcut: "Ctrl+Alt+C", autoHideSeconds: 3, fontSize: "1.5rem" },
      voiceToText: {
        shortcut: "Ctrl+Alt+V",
        baseUrl: "http://api",
        model: "w",
        language: "ja",
      },
    };

    vi.mocked(invoke).mockImplementation(
      async (cmd: string, args?: InvokeArgs) => {
        if (cmd === "load_settings") return mockSettings;
        if (
          cmd === "load_api_key" &&
          args &&
          typeof args === "object" &&
          !Array.isArray(args) &&
          "service" in args &&
          args.service === "voice_to_text"
        ) {
          return "mocked-api-key";
        }
        return undefined;
      },
    );

    render(
      <AppSettingsProvider>
        <VoiceToTextSettings />
      </AppSettingsProvider>,
    );

    // Wait for setting load and API key load
    await act(async () => {
      await Promise.resolve(); // Load settings
      await Promise.resolve(); // Load api key
    });

    const apiKeyInput = screen.getByLabelText("API キー") as HTMLInputElement;
    expect(apiKeyInput.value).toBe("mocked-api-key");
    expect(invoke).toHaveBeenCalledWith("load_api_key", {
      service: "voice_to_text",
    });

    // Change value and blur
    fireEvent.change(apiKeyInput, { target: { value: "new-api-key" } });
    await act(async () => {
      fireEvent.blur(apiKeyInput);
      await Promise.resolve();
    });

    expect(invoke).toHaveBeenCalledWith("save_api_key", {
      service: "voice_to_text",
      key: "new-api-key",
    });
  });
});
