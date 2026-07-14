import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppSettingsProvider } from "../../../core/context/AppSettings";
import { GameArtwork, GameLauncherOverlay } from "./GameLauncherOverlay";

const eventMocks = vi.hoisted(() => ({
  listeners: new Map<string, () => void>(),
}));

const apiMocks = vi.hoisted(() => ({
  launch: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockResolvedValue({
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
    sources: [],
  }),
  openStore: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (event: string, callback: () => void) => {
    eventMocks.listeners.set(event, callback);
    return () => eventMocks.listeners.delete(event);
  }),
}));

vi.mock("../api", () => ({
  launchGame: apiMocks.launch,
  listInstalledGames: apiMocks.list,
  openGameStorePage: apiMocks.openStore,
}));

describe("GameLauncherOverlay", () => {
  afterEach(() => {
    cleanup();
    eventMocks.listeners.clear();
    apiMocks.launch.mockClear();
    apiMocks.list.mockClear();
    apiMocks.openStore.mockClear();
  });

  it("検索してキーボードでゲームを選べる", async () => {
    render(
      <AppSettingsProvider>
        <GameLauncherOverlay />
      </AppSettingsProvider>,
    );

    expect(
      (await screen.findAllByText("Counter-Strike 2")).length,
    ).toBeGreaterThan(0);
    const search = screen.getByRole("searchbox", { name: "ゲームを検索" });
    fireEvent.change(search, { target: { value: "valorant" } });

    expect(screen.queryByText("Counter-Strike 2")).not.toBeInTheDocument();
    expect(screen.getAllByText("VALORANT").length).toBeGreaterThan(0);
    fireEvent.keyDown(search, { key: "Enter" });

    await waitFor(() =>
      expect(apiMocks.launch).toHaveBeenCalledWith({
        id: "valorant",
        store: "riot",
      }),
    );
  });

  it("一致しない検索には空状態を表示する", async () => {
    render(
      <AppSettingsProvider>
        <GameLauncherOverlay />
      </AppSettingsProvider>,
    );
    const search = await screen.findByRole("searchbox", {
      name: "ゲームを検索",
    });
    fireEvent.change(search, { target: { value: "missing-game" } });
    expect(screen.getByText("一致するゲームがありません")).toBeInTheDocument();
  });

  it("clears the game search without closing the launcher", async () => {
    render(
      <AppSettingsProvider>
        <GameLauncherOverlay />
      </AppSettingsProvider>,
    );
    const search = await screen.findByRole("searchbox", {
      name: "ゲームを検索",
    });
    fireEvent.change(search, { target: { value: "valorant" } });

    fireEvent.click(screen.getByRole("button", { name: "ゲーム検索をクリア" }));

    expect(search).toHaveValue("");
    expect(search).toHaveFocus();
    expect(
      screen.getByRole("dialog", { name: "ゲームランチャー" }),
    ).not.toHaveClass("is-hiding");
    expect(screen.getAllByText("Counter-Strike 2").length).toBeGreaterThan(0);
  });

  it("表示中のAlt+1でゲームを起動せず閉じる", async () => {
    render(
      <AppSettingsProvider>
        <GameLauncherOverlay />
      </AppSettingsProvider>,
    );
    const search = await screen.findByRole("searchbox", {
      name: "ゲームを検索",
    });
    fireEvent.keyDown(search, { key: "1", altKey: true });
    expect(
      screen.getByRole("dialog", { name: "ゲームランチャー" }),
    ).toHaveClass("is-hiding");
    expect(screen.queryByText("起動中…")).not.toBeInTheDocument();
  });

  it("再表示時に前回の検索をクリアし、キーボード操作を案内する", async () => {
    render(
      <AppSettingsProvider>
        <GameLauncherOverlay />
      </AppSettingsProvider>,
    );

    const search = await screen.findByRole("searchbox", {
      name: "ゲームを検索",
    });
    expect(search).toHaveAttribute(
      "aria-keyshortcuts",
      "ArrowDown ArrowUp Home End Enter Escape Control+F",
    );
    expect(screen.getByText("↑ ↓ Enter")).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "valorant" } });
    expect(search).toHaveValue("valorant");

    act(() => eventMocks.listeners.get("game-launcher-shown")?.());

    await waitFor(() => expect(search).toHaveValue(""));
  });

  it("アクションボタンのEnterで選択中ゲームを起動しない", async () => {
    render(
      <AppSettingsProvider>
        <GameLauncherOverlay />
      </AppSettingsProvider>,
    );

    const favorite = await screen.findByRole("button", {
      name: "VALORANTをお気に入りに追加",
    });
    fireEvent.keyDown(favorite, { key: "Enter" });

    expect(apiMocks.launch).not.toHaveBeenCalled();
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

  it("お気に入りで並び替わっても操作中のゲームを選択し続ける", async () => {
    const { container } = render(
      <AppSettingsProvider>
        <GameLauncherOverlay />
      </AppSettingsProvider>,
    );
    const favorite = await screen.findByRole("button", {
      name: "VALORANTをお気に入りに追加",
    });
    const valorantRow = favorite.closest(".game-launcher__item");
    if (!valorantRow) throw new Error("VALORANT row was not rendered");
    const valorantLaunch = valorantRow.querySelector(".game-launcher__launch");
    if (!valorantLaunch)
      throw new Error("VALORANT launch action was not rendered");

    fireEvent.mouseEnter(valorantLaunch);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "VALORANT", level: 2 }),
      ).toBeInTheDocument(),
    );
    fireEvent.click(favorite);

    await waitFor(() =>
      expect(
        container.querySelector(".game-launcher__launch strong"),
      ).toHaveTextContent("VALORANT"),
    );
    expect(
      screen.getByRole("heading", { name: "VALORANT", level: 2 }),
    ).toBeInTheDocument();
  });

  it("HomeとEndで移動し、検索中のEscapeは閉じる前に検索だけを消す", async () => {
    render(
      <AppSettingsProvider>
        <GameLauncherOverlay />
      </AppSettingsProvider>,
    );
    const search = await screen.findByRole("searchbox", {
      name: "ゲームを検索",
    });
    await screen.findByRole("button", {
      name: /VALORANTRiot Games/,
    });

    fireEvent.keyDown(search, { key: "End" });
    await waitFor(() =>
      expect(search).toHaveAttribute(
        "aria-activedescendant",
        "game-launcher-game-riot-valorant",
      ),
    );
    fireEvent.keyDown(search, { key: "Home" });
    await waitFor(() =>
      expect(search).toHaveAttribute(
        "aria-activedescendant",
        "game-launcher-game-steam-730",
      ),
    );

    fireEvent.change(search, { target: { value: "valorant" } });
    fireEvent.keyDown(search, { key: "Escape" });
    expect(search).toHaveValue("");
    expect(
      screen.getByRole("dialog", { name: "ゲームランチャー" }),
    ).not.toHaveClass("is-hiding");

    fireEvent.keyDown(search, { key: "Escape" });
    expect(
      screen.getByRole("dialog", { name: "ゲームランチャー" }),
    ).toHaveClass("is-hiding");
  });

  it("アクションからも検索ショートカットへ戻れる", async () => {
    render(
      <AppSettingsProvider>
        <GameLauncherOverlay />
      </AppSettingsProvider>,
    );
    const favorite = await screen.findByRole("button", {
      name: "VALORANTをお気に入りに追加",
    });
    fireEvent.focus(favorite);
    fireEvent.keyDown(favorite, { key: "f", ctrlKey: true });

    expect(
      screen.getByRole("searchbox", { name: "ゲームを検索" }),
    ).toHaveFocus();
  });
});
