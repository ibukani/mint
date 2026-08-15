import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppSettingsProvider } from "../../../core/context/AppSettings";
import { GameLauncherSettings } from "./GameLauncherSettings";

const apiMocks = vi.hoisted(() => ({
  sourceStatus: vi.fn(),
}));

vi.mock("../api", () => ({
  getGameSourceStatus: apiMocks.sourceStatus,
}));

const detectedSources = {
  sources: [
    { store: "steam", detected: true, warning: null },
    { store: "epic", detected: false, warning: null },
    { store: "riot", detected: true, warning: null },
  ],
  gameCounts: { steam: 1, epic: 0, riot: 1 },
};

afterEach(() => {
  apiMocks.sourceStatus.mockReset();
});

describe("GameLauncherSettings", () => {
  it("shows live launcher detection state and game counts", async () => {
    apiMocks.sourceStatus.mockResolvedValue(detectedSources);
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
      screen.getByText(/このPC内のランチャーデータだけから取得/),
    ).toBeInTheDocument();
  });

  it("shows a recoverable error when launcher detection fails", async () => {
    apiMocks.sourceStatus
      .mockRejectedValueOnce(new Error("permission denied"))
      .mockResolvedValueOnce(detectedSources);
    render(
      <AppSettingsProvider>
        <GameLauncherSettings />
      </AppSettingsProvider>,
    );

    expect(
      await screen.findByText(
        "ランチャーを確認できませんでした: permission denied",
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

  it("shows the concrete launcher warning next to its source", async () => {
    apiMocks.sourceStatus.mockResolvedValue({
      ...detectedSources,
      sources: [
        {
          store: "steam",
          detected: true,
          warning: "libraryfolders.vdfを読み取れませんでした",
        },
        ...detectedSources.sources.slice(1),
      ],
    });

    render(
      <AppSettingsProvider>
        <GameLauncherSettings />
      </AppSettingsProvider>,
    );

    expect(
      await screen.findByText("libraryfolders.vdfを読み取れませんでした"),
    ).toBeInTheDocument();
    expect(screen.getByText("一部読み取りエラー")).toBeInTheDocument();
  });
});
