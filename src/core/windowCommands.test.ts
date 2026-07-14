import { describe, expect, it, vi } from "vitest";
import { isOverlayTarget, openOverlay } from "./windowCommands";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
}));

describe("window commands", () => {
  it("invokes the typed overlay command with the stable target", async () => {
    mocks.invoke.mockResolvedValue(undefined);

    await openOverlay("gameLauncher");

    expect(mocks.invoke).toHaveBeenCalledWith("open_overlay", {
      target: "gameLauncher",
    });
  });

  it("recognizes only supported overlay targets", () => {
    expect(isOverlayTarget("clock")).toBe(true);
    expect(isOverlayTarget("fileShelf")).toBe(true);
    expect(isOverlayTarget("settings")).toBe(false);
  });
});
