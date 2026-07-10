import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShortcutInput } from "./ShortcutInput";

describe("ShortcutInput", () => {
  it("renders a readable keycap view while keeping the input value accessible", () => {
    const { container } = render(
      <ShortcutInput id="shortcut" value="Ctrl+Alt+C" onChange={() => {}} />,
    );

    expect(screen.getByRole("textbox")).toHaveValue("Ctrl+Alt+C");
    expect(container.querySelectorAll("kbd")).toHaveLength(3);
    expect(screen.getByText("Ctrl")).toBeInTheDocument();
    expect(screen.getByText("Alt")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
  });

  it("shows an active recording state when focused", () => {
    render(
      <ShortcutInput id="shortcut" value="Ctrl+Alt+C" onChange={() => {}} />,
    );

    fireEvent.focus(screen.getByRole("textbox"));

    expect(screen.getByText("キーの組み合わせを入力")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveClass("is-recording");
  });
});
