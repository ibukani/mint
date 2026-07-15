import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    close: vi.fn(),
    minimize: vi.fn(),
    startDragging: vi.fn(),
  }),
}));

describe("AppShell", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("provides a keyboard skip link to the main content", () => {
    render(
      <AppShell
        title="mint"
        tabs={[{ id: "general", label: "一般設定" }]}
        activeTab="general"
        onTabChange={() => undefined}
      >
        <p>設定コンテンツ</p>
      </AppShell>,
    );

    expect(
      screen.getByRole("link", { name: "メインコンテンツへ移動" }),
    ).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");
  });

  it("opens the settings switcher from the title bar and filters by keywords", () => {
    const onTabChange = vi.fn();
    render(
      <AppShell
        title="mint"
        tabs={[
          {
            id: "general",
            label: "一般設定",
            description: "テーマと起動操作",
            keywords: ["アップデート"],
          },
          {
            id: "voiceToText",
            label: "音声入力",
            description: "音声の文字起こし",
            keywords: ["Whisper"],
          },
        ]}
        activeTab="general"
        onTabChange={onTabChange}
      >
        <p>設定コンテンツ</p>
      </AppShell>,
    );

    const trigger = screen.getByRole("button", {
      name: "クイックランチャーを開く",
    });
    expect(trigger).toHaveAttribute("aria-keyshortcuts", "Control+K");
    trigger.focus();
    fireEvent.click(trigger);

    expect(
      screen.getByRole("dialog", { name: "クイックランチャー" }),
    ).toBeVisible();
    const searchInput = screen.getByRole("combobox", {
      name: "設定や項目、操作を検索",
    });
    expect(searchInput).toHaveFocus();

    fireEvent.change(searchInput, { target: { value: "whisper" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option")).toHaveTextContent("音声入力");
    fireEvent.keyDown(searchInput, { key: "Enter" });

    expect(onTabChange).toHaveBeenCalledWith("voiceToText");
    expect(
      screen.queryByRole("dialog", { name: "クイックランチャー" }),
    ).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("moves through results with arrow keys and selects with Enter", () => {
    const onTabChange = vi.fn();
    render(
      <AppShell
        title="mint"
        tabs={[
          { id: "general", label: "一般設定" },
          { id: "voiceToText", label: "音声入力" },
        ]}
        activeTab="general"
        onTabChange={onTabChange}
      >
        <p>設定コンテンツ</p>
      </AppShell>,
    );

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const searchInput = screen.getByRole("combobox", {
      name: "設定や項目、操作を検索",
    });
    fireEvent.keyDown(searchInput, { key: "ArrowDown" });

    const options = screen.getAllByRole("option");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(searchInput, { key: "Enter" });
    expect(onTabChange).toHaveBeenCalledWith("voiceToText");
  });

  it("jumps to result boundaries with Home, End, and page keys", () => {
    render(
      <AppShell
        title="mint"
        tabs={[
          { id: "general", label: "一般設定" },
          { id: "voiceToText", label: "音声入力" },
          { id: "calendar", label: "カレンダー" },
        ]}
        activeTab="general"
        onTabChange={() => undefined}
      >
        <p>設定コンテンツ</p>
      </AppShell>,
    );

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const searchInput = screen.getByRole("combobox", {
      name: "設定や項目、操作を検索",
    });
    const options = screen.getAllByRole("option");

    fireEvent.keyDown(searchInput, { key: "End" });
    expect(options[2]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(searchInput, { key: "PageUp" });
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(searchInput, { key: "PageDown" });
    expect(options[2]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(searchInput, { key: "Home" });
    expect(options[0]).toHaveAttribute("aria-selected", "true");
  });

  it("finds an individual setting and forwards its focus target", () => {
    const onTabChange = vi.fn();
    render(
      <AppShell
        title="mint"
        tabs={[
          { id: "general", label: "一般設定" },
          {
            id: "voiceToText",
            label: "音声入力",
            searchItems: [
              {
                id: "api-key",
                label: "APIキー",
                description: "音声認識APIの認証情報",
                keywords: ["OpenAI", "Groq"],
                targetId: "v2t-api-key-input",
              },
            ],
          },
        ]}
        activeTab="general"
        onTabChange={onTabChange}
      >
        <p>設定コンテンツ</p>
      </AppShell>,
    );

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const searchInput = screen.getByRole("combobox", {
      name: "設定や項目、操作を検索",
    });
    fireEvent.change(searchInput, { target: { value: "APIキー" } });

    expect(screen.getByRole("option")).toHaveTextContent("APIキー");
    fireEvent.keyDown(searchInput, { key: "Enter" });

    expect(onTabChange).toHaveBeenCalledWith(
      "voiceToText",
      "v2t-api-key-input",
    );
  });

  it("opens a quick action from the settings switcher", async () => {
    const onQuickAction = vi.fn().mockResolvedValue(undefined);
    render(
      <AppShell
        title="mint"
        tabs={[{ id: "general", label: "一般設定" }]}
        activeTab="general"
        onTabChange={() => undefined}
        quickActions={[
          {
            id: "open-clock",
            label: "時計を開く",
            description: "時計オーバーレイを表示",
            keywords: ["時刻"],
            targetId: "clock",
          },
        ]}
        onQuickAction={onQuickAction}
      >
        <p>設定コンテンツ</p>
      </AppShell>,
    );

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const searchInput = screen.getByRole("combobox", {
      name: "設定や項目、操作を検索",
    });
    fireEvent.change(searchInput, { target: { value: "時計" } });
    expect(screen.getByRole("option")).toHaveTextContent("時計を開く");

    fireEvent.keyDown(searchInput, { key: "Enter" });

    await waitFor(() => {
      expect(onQuickAction).toHaveBeenCalledWith("clock");
      expect(
        screen.queryByRole("dialog", { name: "クイックランチャー" }),
      ).toBeNull();
    });
  });

  it("surfaces a successful quick action in recent results", async () => {
    const onQuickAction = vi.fn().mockResolvedValue(undefined);
    render(
      <AppShell
        title="mint"
        tabs={[{ id: "general", label: "一般設定" }]}
        activeTab="general"
        onTabChange={() => undefined}
        quickActions={[
          {
            id: "open-clock",
            label: "時計を開く",
            description: "時計オーバーレイを表示",
            targetId: "clock",
          },
        ]}
        onQuickAction={onQuickAction}
      >
        <p>設定コンテンツ</p>
      </AppShell>,
    );

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.click(screen.getByRole("option", { name: /時計を開く/ }));
    await waitFor(() => {
      expect(onQuickAction).toHaveBeenCalledWith("clock");
      expect(
        screen.queryByRole("dialog", { name: "クイックランチャー" }),
      ).toBeNull();
    });

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByText("最近使った項目")).toBeVisible();
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveTextContent("時計を開く");
    expect(options[0]).toHaveTextContent("最近");
  });

  it("restores successful quick actions after the shell is remounted", async () => {
    const onQuickAction = vi.fn().mockResolvedValue(undefined);
    const renderShell = () =>
      render(
        <AppShell
          title="mint"
          tabs={[{ id: "general", label: "一般設定" }]}
          activeTab="general"
          onTabChange={() => undefined}
          quickActions={[
            {
              id: "open-clock",
              label: "時計を開く",
              description: "時計オーバーレイを表示",
              targetId: "clock",
            },
          ]}
          onQuickAction={onQuickAction}
        >
          <p>設定コンテンツ</p>
        </AppShell>,
      );

    const firstRender = renderShell();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.click(screen.getByRole("option", { name: /時計を開く/ }));
    await waitFor(() => expect(onQuickAction).toHaveBeenCalledWith("clock"));

    firstRender.unmount();
    renderShell();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    expect(screen.getByText("最近使った項目")).toBeVisible();
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("時計を開く");
  });

  it("clears persisted recent results from the quick switcher", async () => {
    const onQuickAction = vi.fn().mockResolvedValue(undefined);
    const renderShell = () =>
      render(
        <AppShell
          title="mint"
          tabs={[{ id: "general", label: "一般設定" }]}
          activeTab="general"
          onTabChange={() => undefined}
          quickActions={[
            {
              id: "open-clock",
              label: "時計を開く",
              targetId: "clock",
            },
          ]}
          onQuickAction={onQuickAction}
        >
          <p>設定コンテンツ</p>
        </AppShell>,
      );

    const firstRender = renderShell();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.click(screen.getByRole("option", { name: /時計を開く/ }));
    await waitFor(() => expect(onQuickAction).toHaveBeenCalledWith("clock"));

    firstRender.unmount();
    renderShell();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByText("最近使った項目")).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "最近使った項目を消去" }),
    );

    expect(screen.queryByText("最近使った項目")).toBeNull();
    expect(
      window.localStorage.getItem(
        "mint.settings-quick-switcher.recent-results",
      ),
    ).toBeNull();
    expect(
      screen.getByRole("combobox", { name: "設定や項目、操作を検索" }),
    ).toHaveFocus();
  });

  it("keeps the quick launcher open when an action fails", async () => {
    const onQuickAction = vi
      .fn()
      .mockRejectedValue(new Error("時計を表示できませんでした。"));
    render(
      <AppShell
        title="mint"
        tabs={[{ id: "general", label: "一般設定" }]}
        activeTab="general"
        onTabChange={() => undefined}
        quickActions={[
          {
            id: "open-clock",
            label: "時計を開く",
            targetId: "clock",
          },
        ]}
        onQuickAction={onQuickAction}
      >
        <p>設定コンテンツ</p>
      </AppShell>,
    );

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const searchInput = screen.getByRole("combobox", {
      name: "設定や項目、操作を検索",
    });
    fireEvent.change(searchInput, { target: { value: "時計" } });
    fireEvent.keyDown(searchInput, { key: "Enter" });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("時計を表示できませんでした。");
    expect(alert).toBeVisible();
    expect(
      screen.getByRole("dialog", { name: "クイックランチャー" }),
    ).toBeVisible();
  });

  it("explains why a disabled quick action cannot run", async () => {
    const onQuickAction = vi.fn().mockResolvedValue(undefined);
    const onTabChange = vi.fn();
    render(
      <AppShell
        title="mint"
        tabs={[{ id: "general", label: "一般設定" }]}
        activeTab="general"
        onTabChange={onTabChange}
        quickActions={[
          {
            id: "open-clock",
            label: "時計を開く",
            description: "時計オーバーレイを表示",
            targetId: "clock",
            disabled: true,
            disabledReason:
              "時計オーバーレイが無効です。詳細設定で有効にしてください。",
            disabledSettingsTarget: {
              tabId: "general",
              targetId: "general-enabled",
            },
          },
        ]}
        onQuickAction={onQuickAction}
      >
        <p>設定コンテンツ</p>
      </AppShell>,
    );

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const searchInput = screen.getByRole("combobox", {
      name: "設定や項目、操作を検索",
    });
    fireEvent.change(searchInput, { target: { value: "時計" } });
    const option = screen.getByRole("option", { name: /時計を開く/ });

    expect(option).toHaveAttribute("aria-disabled", "true");
    expect(option).toHaveTextContent("無効");
    fireEvent.keyDown(searchInput, { key: "Enter" });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "時計オーバーレイが無効です。詳細設定で有効にしてください。",
    );
    expect(onQuickAction).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "クイックランチャー" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "詳細設定を開く" }));
    expect(onTabChange).toHaveBeenCalledWith("general", "general-enabled");
    expect(
      screen.queryByRole("dialog", { name: "クイックランチャー" }),
    ).toBeNull();
  });

  it("does not steal Ctrl+K from an editable control and can clear a query", () => {
    render(
      <AppShell
        title="mint"
        tabs={[{ id: "general", label: "一般設定" }]}
        activeTab="general"
        onTabChange={() => undefined}
      >
        <input aria-label="編集中の入力欄" />
      </AppShell>,
    );

    const input = screen.getByRole("textbox", { name: "編集中の入力欄" });
    fireEvent.keyDown(input, { key: "k", ctrlKey: true });
    expect(
      screen.queryByRole("dialog", { name: "クイックランチャー" }),
    ).toBeNull();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const searchInput = screen.getByRole("combobox", {
      name: "設定や項目、操作を検索",
    });
    fireEvent.change(searchInput, { target: { value: "テーマ" } });
    fireEvent.click(
      screen.getByRole("button", {
        name: "クイックランチャーの検索をクリア",
      }),
    );

    expect(searchInput).toHaveValue("");
    expect(searchInput).toHaveFocus();
  });

  it("shows an empty state without navigating and closes with Escape", () => {
    const onTabChange = vi.fn();
    render(
      <AppShell
        title="mint"
        tabs={[{ id: "general", label: "一般設定" }]}
        activeTab="general"
        onTabChange={onTabChange}
      >
        <p>設定コンテンツ</p>
      </AppShell>,
    );

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const searchInput = screen.getByRole("combobox", {
      name: "設定や項目、操作を検索",
    });
    fireEvent.change(searchInput, { target: { value: "存在しない設定" } });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("一致する設定や操作がありません")).toBeVisible();
    fireEvent.keyDown(searchInput, { key: "Enter" });
    expect(onTabChange).not.toHaveBeenCalled();
    fireEvent.keyDown(searchInput, { key: "Escape" });

    expect(
      screen.queryByRole("dialog", { name: "クイックランチャー" }),
    ).toBeNull();
  });

  it("uses Cmd+K on Apple platforms without taking over Ctrl+K", () => {
    const platform = vi
      .spyOn(window.navigator, "platform", "get")
      .mockReturnValue("MacIntel");
    try {
      render(
        <AppShell
          title="mint"
          tabs={[{ id: "general", label: "一般設定" }]}
          activeTab="general"
          onTabChange={() => undefined}
        >
          <p>設定コンテンツ</p>
        </AppShell>,
      );

      expect(
        screen.getByRole("button", { name: "クイックランチャーを開く" }),
      ).toHaveAttribute("aria-keyshortcuts", "Meta+K");
      fireEvent.keyDown(window, { key: "k", ctrlKey: true });
      expect(
        screen.queryByRole("dialog", { name: "クイックランチャー" }),
      ).toBeNull();

      fireEvent.keyDown(window, { key: "k", metaKey: true });
      expect(
        screen.getByRole("dialog", { name: "クイックランチャー" }),
      ).toBeVisible();
    } finally {
      platform.mockRestore();
    }
  });
});
