import { invoke } from "@tauri-apps/api/core";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppSettingsProvider } from "../../context/AppSettings";
import { SettingsNavigationProvider } from "../../context/SettingsNavigation";
import { createMockSettings } from "../../mocks/mockSettings";
import { GeneralSettings } from "./GeneralSettings";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("GeneralSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoke).mockResolvedValue(
      createMockSettings({ theme: "dark" }) as never,
    );
  });

  it("lets users choose a theme directly from the preview cards", async () => {
    render(
      <AppSettingsProvider>
        <GeneralSettings />
      </AppSettingsProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    const darkTheme = screen.getByRole("radio", { name: /ダーク/ });
    const lightTheme = screen.getByRole("radio", { name: /ライト/ });
    const systemTheme = screen.getByRole("radio", { name: /システム/ });
    expect(darkTheme).toBeChecked();
    expect(lightTheme).not.toBeChecked();
    expect(systemTheme).not.toBeChecked();

    await act(async () => {
      fireEvent.click(lightTheme);
      await Promise.resolve();
    });

    expect(lightTheme).toBeChecked();
    expect(darkTheme).not.toBeChecked();

    await act(async () => {
      fireEvent.click(systemTheme);
      await Promise.resolve();
    });

    expect(systemTheme).toBeChecked();
    expect(lightTheme).not.toBeChecked();
  });

  it("lets users toggle the autostart setting", async () => {
    render(
      <AppSettingsProvider>
        <GeneralSettings />
      </AppSettingsProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    const autostartToggle = screen.getByRole("switch", {
      name: "PC起動時に自動で起動する",
    });
    expect(autostartToggle).not.toBeChecked();

    await act(async () => {
      fireEvent.click(autostartToggle);
      await Promise.resolve();
    });
    expect(autostartToggle).toBeChecked();
  });

  it("summarizes feature availability and opens the selected feature settings", async () => {
    const setActiveTab = vi.fn();
    render(
      <AppSettingsProvider>
        <SettingsNavigationProvider
          activeTab="general"
          setActiveTab={setActiveTab}
        >
          <GeneralSettings />
        </SettingsNavigationProvider>
      </AppSettingsProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.getByRole("heading", { name: "機能一覧" }),
    ).toBeInTheDocument();
    expect(screen.getByText("5 / 6 有効")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /音声入力.*音声ファイルをテキストに変換/,
      }),
    ).toHaveTextContent("無効");

    fireEvent.click(
      screen.getByRole("button", {
        name: /カレンダー.*予定をオーバーレイですぐ確認/,
      }),
    );

    expect(setActiveTab).toHaveBeenCalledWith("calendar");
  });
});
