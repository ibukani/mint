import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShortcutInput } from "./ShortcutInput";

describe("ShortcutInput", () => {
  it("renders a readable keycap view while keeping the input value accessible", () => {
    const { container } = render(
      <ShortcutInput id="shortcut" value="Alt+Left" onChange={() => {}} />,
    );

    expect(screen.getByRole("textbox")).toHaveValue("Alt+Left");
    expect(container.querySelectorAll("kbd")).toHaveLength(2);
    expect(screen.getByText("Alt")).toBeInTheDocument();
    expect(screen.getByText("Left")).toBeInTheDocument();
  });

  it("shows an active recording state when focused", () => {
    render(
      <ShortcutInput id="shortcut" value="Alt+Left" onChange={() => {}} />,
    );

    fireEvent.focus(screen.getByRole("textbox"));

    expect(screen.getByText("キーの組み合わせを入力")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveClass("is-recording");
  });
});
