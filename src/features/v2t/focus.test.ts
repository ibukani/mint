import { beforeEach, describe, expect, it, vi } from "vitest";
import { focusAndSelect } from "./focus";

describe("focusAndSelect", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main class="app-content">
        <input id="target" value="文字起こし結果" />
      </main>
    `;
  });

  it("selects the field and reveals it inside the settings scroller", () => {
    const container = document.querySelector<HTMLElement>(".app-content");
    const input = document.getElementById("target") as HTMLInputElement;
    if (!container) throw new Error("Test scroll container is missing.");
    container.scrollTop = 10;
    container.getBoundingClientRect = vi.fn(() => ({
      top: 0,
      right: 300,
      bottom: 100,
      left: 0,
      width: 300,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }));
    input.getBoundingClientRect = vi.fn(() => ({
      top: 120,
      right: 280,
      bottom: 140,
      left: 20,
      width: 260,
      height: 20,
      x: 20,
      y: 120,
      toJSON: () => ({}),
    }));

    focusAndSelect("target");

    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
    expect(container.scrollTop).toBe(74);
  });
});
