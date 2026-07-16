import { describe, expect, it } from "vitest";
import { formatBytes, isSupportedUrl, matchesQuery } from "./utils";

describe("file shelf utilities", () => {
  it("formats byte sizes for the shelf", () => {
    expect(formatBytes(null)).toBeNull();
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(1024 * 1024 * 1.5)).toBe("1.5 MB");
  });

  it("accepts only supported shelf URL protocols", () => {
    expect(isSupportedUrl("https://example.com")).toBe(true);
    expect(isSupportedUrl("mailto:user@example.com")).toBe(true);
    expect(isSupportedUrl("javascript:alert(1)")).toBe(false);
    expect(isSupportedUrl("not a URL")).toBe(false);
  });

  it("matches display and source metadata", () => {
    expect(
      matchesQuery(
        {
          id: "item",
          groupId: "group",
          kind: "text",
          displayName: "Meeting notes",
          sourcePath: null,
          textContent: "Project Alpha",
          mimeType: "text/plain",
          sizeBytes: null,
          createdAt: "2026-07-15T00:00:00Z",
          availability: "ready",
          source: "manual",
          pinned: false,
        },
        "alpha",
      ),
    ).toBe(true);
  });
});
