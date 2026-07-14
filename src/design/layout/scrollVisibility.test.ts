import { describe, expect, it } from "vitest";
import { revealElementVertically } from "./scrollVisibility";

const rect = (top: number, bottom: number): DOMRect =>
  ({
    top,
    bottom,
    left: 0,
    right: 100,
    width: 100,
    height: bottom - top,
    x: 0,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

describe("revealElementVertically", () => {
  it("scrolls only the container when an item is below the viewport", () => {
    const container = document.createElement("div");
    const element = document.createElement("button");
    container.scrollTop = 40;
    container.getBoundingClientRect = () => rect(100, 220);
    element.getBoundingClientRect = () => rect(240, 280);

    revealElementVertically(container, element, 8);

    expect(container.scrollTop).toBe(108);
  });

  it("does not move a container when the item is already visible", () => {
    const container = document.createElement("div");
    const element = document.createElement("button");
    container.scrollTop = 40;
    container.getBoundingClientRect = () => rect(100, 220);
    element.getBoundingClientRect = () => rect(130, 170);

    revealElementVertically(container, element, 8);

    expect(container.scrollTop).toBe(40);
  });
});
