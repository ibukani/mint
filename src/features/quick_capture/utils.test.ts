import { describe, expect, it } from "vitest";
import { noteTitle, parseTags, safeFileName } from "./utils";

describe("quick capture utilities", () => {
  it("extracts a useful note title", () => {
    expect(noteTitle({ content: "\n  見出し  \n本文" })).toBe("見出し");
    expect(noteTitle({ content: "\n  " })).toBe("無題のメモ");
  });

  it("parses comma-separated tags", () => {
    expect(parseTags(" work,  idea ,, ")).toEqual(["work", "idea"]);
  });

  it("sanitizes markdown export names", () => {
    expect(safeFileName("  meeting/report  ")).toBe("meeting-report.md");
    expect(safeFileName(" ")).toBe("quick-capture.md");
  });
});
