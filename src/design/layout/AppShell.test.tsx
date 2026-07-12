import { render, screen } from "@testing-library/react";
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
});
