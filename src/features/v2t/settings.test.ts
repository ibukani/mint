import { describe, expect, it } from "vitest";
import {
  validateBaseUrl,
  validateLanguageCode,
  validateModelName,
} from "./settings";

describe("Voice to Text setting validation", () => {
  it("accepts HTTP(S) API endpoints and rejects unsupported protocols", () => {
    expect(validateBaseUrl(" https://api.example.com/v1 ")).toBeUndefined();
    expect(validateBaseUrl("ftp://api.example.com")).toContain("http://");
    expect(validateBaseUrl("not a url")).toContain("有効な");
  });

  it("requires a model name", () => {
    expect(validateModelName("whisper-1")).toBeUndefined();
    expect(validateModelName("   ")).toBe("モデル名を入力してください。");
  });

  it("accepts two or three letter language codes", () => {
    expect(validateLanguageCode(" JA ")).toBeUndefined();
    expect(validateLanguageCode("english")).toContain("2〜3文字");
  });
});
