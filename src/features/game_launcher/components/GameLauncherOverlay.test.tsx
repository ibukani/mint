import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AppSettingsProvider } from "../../../core/context/AppSettings";
import { GameArtwork, GameLauncherOverlay } from "./GameLauncherOverlay";

describe("GameLauncherOverlay", () => {
  afterEach(cleanup);

  it("検索してキーボードでゲームを選べる", async () => {
    render(
      <AppSettingsProvider>
        <GameLauncherOverlay />
      </AppSettingsProvider>,
    );

    expect(
      (await screen.findAllByText("Counter-Strike 2")).length,
    ).toBeGreaterThan(0);
    const search = screen.getByRole("textbox", { name: "ゲームを検索" });
    fireEvent.change(search, { target: { value: "valorant" } });

    expect(screen.queryByText("Counter-Strike 2")).not.toBeInTheDocument();
    expect(screen.getAllByText("VALORANT").length).toBeGreaterThan(0);
    fireEvent.keyDown(search, { key: "Enter" });

    await waitFor(() =>
      expect(screen.queryByText("起動中…")).not.toBeInTheDocument(),
    );
  });

  it("一致しない検索には空状態を表示する", async () => {
    render(
      <AppSettingsProvider>
        <GameLauncherOverlay />
      </AppSettingsProvider>,
    );
    const search = await screen.findByRole("textbox", { name: "ゲームを検索" });
    fireEvent.change(search, { target: { value: "missing-game" } });
    expect(screen.getByText("一致するゲームがありません")).toBeInTheDocument();
  });

  it("表示中のAlt+1でゲームを起動せず閉じる", async () => {
    render(
      <AppSettingsProvider>
        <GameLauncherOverlay />
      </AppSettingsProvider>,
    );
    const search = await screen.findByRole("textbox", { name: "ゲームを検索" });
    fireEvent.keyDown(search, { key: "1", altKey: true });
    expect(
      screen.getByRole("dialog", { name: "ゲームランチャー" }),
    ).toHaveClass("is-hiding");
    expect(screen.queryByText("起動中…")).not.toBeInTheDocument();
  });

  it("バックエンドで抽出したdata URLのゲームアイコンを表示する", () => {
    const imagePath = "data:image/png;base64,aWNvbg==";
    render(
      <GameArtwork
        game={{
          id: "valorant",
          title: "VALORANT",
          store: "riot",
          imagePath,
          fallbackImagePath: null,
        }}
      />,
    );
    expect(document.querySelector("img")).toHaveAttribute("src", imagePath);
  });

  it("主画像の読み込み失敗時にローカル画像へフォールバックする", () => {
    render(
      <GameArtwork
        game={{
          id: "730",
          title: "Counter-Strike 2",
          store: "steam",
          imagePath: "https://example.invalid/header.jpg",
          fallbackImagePath: "data:image/png;base64,aWNvbg==",
        }}
      />,
    );
    const image = document.querySelector(".game-launcher__artwork");
    if (!image) throw new Error("game artwork was not rendered");
    fireEvent.error(image);
    expect(image).toHaveAttribute("src", "data:image/png;base64,aWNvbg==");
  });

  it("画像の読み込み中もゲームの頭文字を表示する", () => {
    render(
      <GameArtwork
        game={{
          id: "730",
          title: "Counter-Strike 2",
          store: "steam",
          imagePath: "https://example.invalid/header.jpg",
          fallbackImagePath: null,
        }}
      />,
    );

    expect(
      document.querySelector(".game-launcher__artwork-initial"),
    ).toHaveTextContent("CS2");
    expect(document.querySelector(".game-launcher__artwork")).not.toHaveClass(
      "is-loaded",
    );
  });

  it("お気に入りを切り替えると一覧の先頭へ移動する", async () => {
    const { container } = render(
      <AppSettingsProvider>
        <GameLauncherOverlay />
      </AppSettingsProvider>,
    );
    const favorite = await screen.findByRole("button", {
      name: "VALORANTをお気に入りに追加",
    });
    fireEvent.click(favorite);
    expect(
      screen.getByRole("button", {
        name: "VALORANTをお気に入りから削除",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      container.querySelector(".game-launcher__launch strong"),
    ).toHaveTextContent("VALORANT");
  });
});
