import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the active tab reachable without scrolling the page", () => {
    const scrollTo = vi.fn();
    const originalClientWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientWidth",
    );
    const originalScrollWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollWidth",
    );
    const originalScrollTo = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollTo",
    );
    const originalOffsetLeft = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "offsetLeft",
    );
    const originalOffsetWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "offsetWidth",
    );

    try {
      Object.defineProperty(HTMLElement.prototype, "clientWidth", {
        configurable: true,
        get() {
          return this.classList.contains("app-sidebar__navigation") ? 100 : 0;
        },
      });
      Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
        configurable: true,
        get() {
          return this.classList.contains("app-sidebar__navigation") ? 300 : 0;
        },
      });
      Object.defineProperty(HTMLElement.prototype, "scrollTo", {
        configurable: true,
        value: scrollTo,
      });
      Object.defineProperty(HTMLElement.prototype, "offsetLeft", {
        configurable: true,
        get() {
          return this.classList.contains("app-sidebar__button--active")
            ? 220
            : 0;
        },
      });
      Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
        configurable: true,
        get() {
          return this.classList.contains("app-sidebar__button") ? 80 : 0;
        },
      });

      const { container } = render(
        <Sidebar
          title="mint"
          tabs={[
            { id: "general", label: "一般設定" },
            { id: "clock", label: "時計オーバーレイ" },
            { id: "voiceToText", label: "音声入力" },
          ]}
          activeTab="voiceToText"
          onTabChange={() => undefined}
        />,
      );

      const navigation = container.querySelector(".app-sidebar__navigation");
      if (!navigation) throw new Error("navigation is missing");
      expect(scrollTo).toHaveBeenCalledWith({
        left: 200,
        behavior: "smooth",
      });
    } finally {
      for (const [property, descriptor] of [
        ["clientWidth", originalClientWidth],
        ["scrollWidth", originalScrollWidth],
        ["scrollTo", originalScrollTo],
        ["offsetLeft", originalOffsetLeft],
        ["offsetWidth", originalOffsetWidth],
      ] as const) {
        if (descriptor) {
          Object.defineProperty(HTMLElement.prototype, property, descriptor);
        } else {
          Reflect.deleteProperty(HTMLElement.prototype, property);
        }
      }
    }
  });

  it("exposes the save state through matching text and visual tone", () => {
    const { container } = render(
      <Sidebar
        title="mint"
        tabs={[{ id: "general", label: "一般設定" }]}
        activeTab="general"
        onTabChange={() => undefined}
        statusLabel="保存に失敗しました"
        statusTone="error"
      />,
    );

    expect(screen.getByText("保存エラー")).toBeInTheDocument();
    expect(screen.getByText("保存に失敗しました")).toBeInTheDocument();
    expect(
      container.querySelector(".app-sidebar__status-dot--error"),
    ).toBeInTheDocument();
  });

  it("shows the Command modifier on Apple platforms", () => {
    vi.spyOn(window.navigator, "platform", "get").mockReturnValue("MacIntel");

    render(
      <Sidebar
        title="mint"
        tabs={[{ id: "general", label: "一般設定" }]}
        activeTab="general"
        onTabChange={() => undefined}
      />,
    );

    expect(screen.getByText("⌘ 1")).toBeInTheDocument();
  });
});
