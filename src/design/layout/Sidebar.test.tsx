import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the active tab reachable in a horizontal navigation", () => {
    const scrollIntoView = vi.fn();
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollIntoView",
    );

    try {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: scrollIntoView,
      });

      render(
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

      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          "scrollIntoView",
          originalDescriptor,
        );
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
      }
    }
  });
});
