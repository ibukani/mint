import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsSaveStatus } from "./SettingsSaveStatus";

describe("SettingsSaveStatus", () => {
  it("offers a persistent retry action after a save failure", () => {
    const onRetry = vi.fn();
    render(<SettingsSaveStatus status="error" onRetry={onRetry} />);

    expect(screen.getByRole("status")).toHaveTextContent("保存失敗");
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("does not show a retry action for successful saves", () => {
    render(<SettingsSaveStatus status="saved" onRetry={vi.fn()} />);

    expect(screen.getByRole("status")).toHaveTextContent("保存完了");
    expect(screen.queryByRole("button", { name: "再試行" })).toBeNull();
  });
});
