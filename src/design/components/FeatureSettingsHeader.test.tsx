import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FeatureSettingsHeader } from "./FeatureSettingsHeader";

describe("FeatureSettingsHeader", () => {
  it("exposes the disabled state and an accessible reset action", () => {
    const onReset = vi.fn();
    const { container } = render(
      <FeatureSettingsHeader
        switchId="feature-enabled"
        label="音声入力"
        enabled={false}
        onChange={() => undefined}
        onReset={onReset}
      />,
    );

    expect(
      container.querySelector(".feature-settings-header.is-disabled"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", {
        name: "この機能を有効にする (Enable Feature)",
      }),
    ).not.toBeChecked();

    const reset = screen.getByRole("button", { name: "デフォルトに戻す" });
    expect(reset).toHaveAttribute("title", "デフォルトに戻す");
    fireEvent.click(reset);
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("marks an enabled feature for the visual state layer", () => {
    const { container } = render(
      <FeatureSettingsHeader
        switchId="feature-enabled"
        label="時計オーバーレイ"
        enabled
        onChange={() => undefined}
        onReset={() => undefined}
      />,
    );

    expect(
      container.querySelector(".feature-settings-header.is-enabled"),
    ).toBeInTheDocument();
    expect(screen.getByText("有効")).toBeInTheDocument();
  });
});
