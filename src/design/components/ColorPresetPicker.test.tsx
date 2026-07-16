import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ColorPresetPicker } from "./ColorPresetPicker";

describe("ColorPresetPicker", () => {
  it("renders the shared presets and reports the selected color", () => {
    const onChange = vi.fn();

    render(
      <ColorPresetPicker
        value="#34d399"
        onChange={onChange}
        ariaLabel="時計のテーマカラー"
      />,
    );

    const group = screen.getByRole("group", { name: "時計のテーマカラー" });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(6);
    expect(screen.getByRole("button", { name: "ミント" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "ローズ" }));
    expect(onChange).toHaveBeenCalledWith("#fb7185");
  });
});
