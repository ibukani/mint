import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFocusAndSelectElementById } from "./useFocusAndSelectElementById";

function FocusTarget({ shouldFocus }: { shouldFocus: boolean }) {
  useFocusAndSelectElementById(shouldFocus, "sample");

  return <input id="sample" defaultValue="hello" />;
}

function FocusTargetToggle() {
  const [shouldFocus, setShouldFocus] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setShouldFocus(true)}>
        focus
      </button>
      <FocusTarget shouldFocus={shouldFocus} />
    </>
  );
}

describe("useFocusAndSelectElementById", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("focuses and selects the element when enabled", () => {
    const focusSpy = vi.spyOn(HTMLInputElement.prototype, "focus");
    const selectSpy = vi.spyOn(HTMLInputElement.prototype, "select");

    render(<FocusTarget shouldFocus />);

    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(selectSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  it("does nothing when disabled", () => {
    const focusSpy = vi.spyOn(HTMLInputElement.prototype, "focus");
    const selectSpy = vi.spyOn(HTMLInputElement.prototype, "select");

    render(<FocusTarget shouldFocus={false} />);

    expect(focusSpy).not.toHaveBeenCalled();
    expect(selectSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).not.toHaveFocus();
  });

  it("focuses after the flag turns true", () => {
    const focusSpy = vi.spyOn(HTMLInputElement.prototype, "focus");
    const selectSpy = vi.spyOn(HTMLInputElement.prototype, "select");

    render(<FocusTargetToggle />);

    fireEvent.click(screen.getByRole("button", { name: "focus" }));

    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(selectSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("textbox")).toHaveFocus();
  });
});
