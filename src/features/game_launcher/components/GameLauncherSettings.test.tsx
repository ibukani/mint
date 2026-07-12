import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppSettingsProvider } from "../../../core/context/AppSettings";
import { GameLauncherSettings } from "./GameLauncherSettings";

describe("GameLauncherSettings", () => {
  it("shows supported launchers and explains local-only detection", async () => {
    render(
      <AppSettingsProvider>
        <GameLauncherSettings />
      </AppSettingsProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "ゲームランチャー", level: 2 }),
      ).toBeInTheDocument();
    });

    expect(screen.getByRole("heading", { name: "Steam" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Epic Games" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Riot Games" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("自動検出")).toHaveLength(3);
    expect(
      screen.getByText(/ライブラリ情報はこのPC上でのみ確認/),
    ).toBeInTheDocument();
  });
});
