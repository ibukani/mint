import { afterEach, describe, expect, it, vi } from "vitest";
import { focusAndSelectElement, focusAndSelectElementById } from "./focus";

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

  it("focuses and selects a provided element directly", () => {
    document.body.innerHTML = `<input id="sample" value="hello" />`;
    const input = document.getElementById("sample") as HTMLInputElement;
    const focusSpy = vi.spyOn(input, "focus");
    const selectSpy = vi.spyOn(input, "select");

    focusAndSelectElement(input);

    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(selectSpy).toHaveBeenCalledTimes(1);
  });

  it("ignores missing elements", () => {
    expect(() => focusAndSelectElement(null)).not.toThrow();
    expect(() => focusAndSelectElementById("missing")).not.toThrow();
  });
});
