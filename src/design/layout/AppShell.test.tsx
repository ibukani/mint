import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    close: vi.fn(),
    minimize: vi.fn(),
    startDragging: vi.fn(),
  }),
}));

describe("AppShell", () => {
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

    const trigger = screen.getByRole("button", { name: "設定を検索" });
    expect(trigger).toHaveAttribute("aria-keyshortcuts", "Control+K");
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog", { name: "設定を検索" })).toBeVisible();
    const searchInput = screen.getByRole("combobox", {
      name: "設定カテゴリを検索",
    });
    expect(searchInput).toHaveFocus();

    fireEvent.change(searchInput, { target: { value: "whisper" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option")).toHaveTextContent("音声入力");
    fireEvent.keyDown(searchInput, { key: "Enter" });

    expect(onTabChange).toHaveBeenCalledWith("voiceToText");
    expect(screen.queryByRole("dialog", { name: "設定を検索" })).toBeNull();
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
      name: "設定カテゴリを検索",
    });
    fireEvent.keyDown(searchInput, { key: "ArrowDown" });

    const options = screen.getAllByRole("option");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(searchInput, { key: "Enter" });
    expect(onTabChange).toHaveBeenCalledWith("voiceToText");
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
    expect(screen.queryByRole("dialog", { name: "設定を検索" })).toBeNull();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const searchInput = screen.getByRole("combobox", {
      name: "設定カテゴリを検索",
    });
    fireEvent.change(searchInput, { target: { value: "テーマ" } });
    fireEvent.click(screen.getByRole("button", { name: "設定検索をクリア" }));

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
      name: "設定カテゴリを検索",
    });
    fireEvent.change(searchInput, { target: { value: "存在しない設定" } });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("一致する設定がありません")).toBeVisible();
    fireEvent.keyDown(searchInput, { key: "Enter" });
    expect(onTabChange).not.toHaveBeenCalled();
    fireEvent.keyDown(searchInput, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "設定を検索" })).toBeNull();
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
        screen.getByRole("button", { name: "設定を検索" }),
      ).toHaveAttribute("aria-keyshortcuts", "Meta+K");
      fireEvent.keyDown(window, { key: "k", ctrlKey: true });
      expect(screen.queryByRole("dialog", { name: "設定を検索" })).toBeNull();

      fireEvent.keyDown(window, { key: "k", metaKey: true });
      expect(screen.getByRole("dialog", { name: "設定を検索" })).toBeVisible();
    } finally {
      platform.mockRestore();
    }
  });
});
