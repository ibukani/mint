import { describe, expect, it } from "vitest";
import { redactRecord, redactSensitiveText } from "./redact";

describe("redactSensitiveText", () => {
  it("redacts OpenAI-style API keys", () => {
    expect(redactSensitiveText("key=sk-1234567890abcdef1234567890abcdef")).toBe(
      "key=sk-1***",
    );
  });

  it("redacts api_key and token assignments", () => {
    expect(redactSensitiveText('api_key = "secret-value-12345"')).toContain(
      "api_key =",
    );
    expect(redactSensitiveText('api_key = "secret-value-12345"')).not.toContain(
      "secret-value-12345",
    );
  });

  it("keeps short non-secret values untouched", () => {
    expect(redactSensitiveText("key=ok")).toBe("key=ok");
  });

  it("replaces absolute paths but keeps the file name", () => {
    const redacted = redactSensitiveText("saved to C:\\Users\\demo\\notes.md");
    expect(redacted).toContain("[パス]\\notes.md");
    expect(redacted).not.toContain("C:\\Users");
    const unix = redactSensitiveText("file at /home/demo/notes.md");
    expect(unix).toContain("[パス]/notes.md");
  });

  it("replaces email addresses", () => {
    expect(redactSensitiveText("contact demo@example.com now")).toBe(
      "contact [メールアドレス] now",
    );
  });
});

describe("redactRecord", () => {
  it("redacts every string value", () => {
    const result = redactRecord({
      path: "C:\\Users\\demo\\secret.txt",
      key: "sk-abcdefghijklmnop",
      note: "plain text",
    });
    expect(result.path).toContain("[パス]");
    expect(result.key).not.toContain("abcdefghijklmnop");
    expect(result.note).toBe("plain text");
  });
});
