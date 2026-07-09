import { afterEach, describe, expect, it, vi } from "vitest";
import { focusAndSelectElementById } from "./focus";

describe("focusAndSelectElementById", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("focuses and selects a matching input element", () => {
    document.body.innerHTML = `<input id="sample" value="hello" />`;
    const input = document.getElementById("sample") as HTMLInputElement;
    const focusSpy = vi.spyOn(input, "focus");
    const selectSpy = vi.spyOn(input, "select");

    focusAndSelectElementById("sample");

    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(selectSpy).toHaveBeenCalledTimes(1);
  });

  it("ignores missing elements", () => {
    expect(() => focusAndSelectElementById("missing")).not.toThrow();
  });
});
