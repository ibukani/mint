import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppSettingsProvider } from "../../../core/context/AppSettings";
import { GameLauncherSettings } from "./GameLauncherSettings";

const apiMocks = vi.hoisted(() => ({
  list: vi.fn(),
}));

vi.mock("../api", () => ({
  listInstalledGames: apiMocks.list,
}));

const detectedSources = {
  games: [
    {
      id: "730",
      title: "Counter-Strike 2",
      store: "steam",
      imagePath: null,
      fallbackImagePath: null,
    },
    {
      id: "valorant",
      title: "VALORANT",
      store: "riot",
      imagePath: null,
      fallbackImagePath: null,
    },
  ],
  sources: [
    { store: "steam", detected: true, warning: null },
    { store: "epic", detected: false, warning: null },
    { store: "riot", detected: true, warning: null },
  ],
};

afterEach(() => {
  apiMocks.list.mockReset();
});

describe("GameLauncherSettings", () => {
  it("shows live launcher detection state and game counts", async () => {
    apiMocks.list.mockResolvedValue(detectedSources);
    render(
      <AppSettingsProvider>
        <GameLauncherSettings />
      </AppSettingsProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "ゲームランチャー設定", level: 2 }),
      ).toBeInTheDocument();
    });

    expect(screen.getByRole("heading", { name: "Steam" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Epic Games" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Riot Games" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("検出済み")).toHaveLength(2);
    expect(screen.getByText("未検出")).toBeInTheDocument();
    expect(screen.getAllByText("1本")).toHaveLength(2);
    expect(screen.getByText("再確認")).toBeInTheDocument();
    expect(
      screen.getByText(/ライブラリ情報はこのPC上でのみ確認/),
    ).toBeInTheDocument();
  });

  it("shows a recoverable error when launcher detection fails", async () => {
    apiMocks.list
      .mockRejectedValueOnce(new Error("permission denied"))
      .mockResolvedValueOnce(detectedSources);
    render(
      <AppSettingsProvider>
        <GameLauncherSettings />
      </AppSettingsProvider>,
    );

    expect(
      await screen.findByText(
        "ランチャーを確認できませんでした。再確認してください。",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("確認できません")).toHaveLength(3);
    expect(
      screen.getByRole("button", { name: "対応ランチャーを再確認" }),
    ).toBeEnabled();

    fireEvent.click(
      screen.getByRole("button", { name: "対応ランチャーを再確認" }),
    );
    expect((await screen.findAllByText("検出済み")).length).toBe(2);
  });
});
