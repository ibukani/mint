import { describe, expect, it } from "vitest";
import { createMockSettings } from "../mocks/mockSettings";
import {
  MINT_ACTIONS,
  normalizeActionText,
  searchMintActions,
} from "./mintActions";

describe("MINT_ACTIONS registry", () => {
  it("keeps every action key unique", () => {
    const keys = MINT_ACTIONS.map((action) => action.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("provides availability and execute for every action", () => {
    for (const action of MINT_ACTIONS) {
      expect(typeof action.availability).toBe("function");
      expect(typeof action.execute).toBe("function");
    }
  });

  it("covers tab, setting and action categories", () => {
    const categories = new Set(MINT_ACTIONS.map((action) => action.category));
    expect(categories.has("tab")).toBe(true);
    expect(categories.has("setting")).toBe(true);
    expect(categories.has("action")).toBe(true);
  });

  it("lists all actions for an empty query", () => {
    const search = searchMintActions(MINT_ACTIONS, "", []);
    expect(search.results).toHaveLength(MINT_ACTIONS.length);
  });

  it("ranks title prefix matches before later matches", () => {
    const search = searchMintActions(MINT_ACTIONS, "ダーク", []);
    expect(search.results[0]?.key).toBe("action:set-theme-dark");
  });

  it("ranks an exact title match above everything else", () => {
    const search = searchMintActions(MINT_ACTIONS, "時計を開く", []);
    expect(search.results[0]?.key).toBe("action:open-clock");
  });

  it("matches keywords and descriptions as a fallback", () => {
    const search = searchMintActions(MINT_ACTIONS, "パレット", []);
    const keys = search.results.map((action) => action.key);
    expect(keys).toContain("action:open-mint-palette");
    expect(keys).toContain("tab:mintPalette");
  });

  it("drops results that match nothing", () => {
    const search = searchMintActions(MINT_ACTIONS, "存在しない操作", []);
    expect(search.results).toHaveLength(0);
  });

  it("moves recent actions to the front for an empty query", () => {
    const search = searchMintActions(MINT_ACTIONS, "", [
      "action:open-clock",
      "tab:general",
    ]);
    expect(search.results[0]?.key).toBe("action:open-clock");
    expect(search.results[1]?.key).toBe("tab:general");
  });

  it("marks an action as unavailable when its feature is disabled", () => {
    const settings = createMockSettings({
      clock: { ...createMockSettings().clock, enabled: false },
    });
    const clockAction = MINT_ACTIONS.find(
      (action) => action.key === "action:open-clock",
    );
    expect(clockAction).toBeDefined();
    const availability = clockAction?.availability(settings);
    expect(availability?.available).toBe(false);
    expect(availability?.reason).toContain("時計オーバーレイが無効です");
    expect(availability?.disabledSettingsTarget).toEqual({
      tabId: "clock",
      targetId: "clock-enabled-checkbox",
    });
  });

  it("keeps tab and setting actions available with settings", () => {
    const settings = createMockSettings();
    const tabAction = MINT_ACTIONS.find((action) => action.category === "tab");
    const settingAction = MINT_ACTIONS.find(
      (action) => action.category === "setting",
    );
    expect(tabAction?.availability(settings).available).toBe(true);
    expect(settingAction?.availability(settings).available).toBe(true);
  });
});

describe("normalizeActionText", () => {
  it("lowercases and strips whitespace", () => {
    expect(normalizeActionText("  Ctrl + K ")).toBe("ctrl+k");
    expect(normalizeActionText("ダーク テーマ")).toBe("ダークテーマ");
  });
});
