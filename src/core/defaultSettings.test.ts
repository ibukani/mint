import { describe, expect, it } from "vitest";
import { defaultAppSettings } from "./defaultSettings";

describe("defaultAppSettings", () => {
  it("does not create the WebView-backed file shelf handle by default", () => {
    expect(defaultAppSettings.fileShelf.edgeHandleEnabled).toBe(false);
  });
});
