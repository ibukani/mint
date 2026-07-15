import { describe, expect, it } from "vitest";
import { applicationNameFromPath } from "./api";

describe("file shelf API helpers", () => {
  it("extracts executable names from Windows and Unix-style paths", () => {
    expect(applicationNameFromPath("C:\\Program Files\\App\\App.exe")).toBe(
      "App.exe",
    );
    expect(applicationNameFromPath("C:/Portable/App.exe")).toBe("App.exe");
    expect(applicationNameFromPath("  App.exe  ")).toBe("App.exe");
    expect(applicationNameFromPath("   ")).toBeNull();
  });
});
