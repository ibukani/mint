import { describe, expect, it } from "vitest";
import { CROSS_FEATURE_ACTIONS, getCrossFeatureAction } from "./registry";

describe("CROSS_FEATURE_ACTIONS registry", () => {
  it("registers the three expected cross-feature actions", () => {
    const ids = CROSS_FEATURE_ACTIONS.map((action) => action.id);
    expect(ids).toContain("file-shelf:save-as-note");
    expect(ids).toContain("file-shelf:transcribe-audio");
    expect(ids).toContain("quick-capture:create-event");
  });

  it("keeps every action id unique", () => {
    const ids = CROSS_FEATURE_ACTIONS.map((action) => action.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("exposes source and destination features for every action", () => {
    for (const action of CROSS_FEATURE_ACTIONS) {
      expect(action.sourceFeature).toBeTruthy();
      expect(action.destinationFeature).toBeTruthy();
      expect(action.sourceFeature).not.toBe(action.destinationFeature);
      expect(typeof action.availability).toBe("function");
      expect(typeof action.execute).toBe("function");
      expect(typeof action.inputSchema.parse).toBe("function");
    }
  });

  it("resolves actions by id", () => {
    expect(getCrossFeatureAction("file-shelf:save-as-note")?.id).toBe(
      "file-shelf:save-as-note",
    );
    expect(getCrossFeatureAction("unknown-action")).toBeUndefined();
  });
});
