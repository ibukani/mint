import { invoke } from "@tauri-apps/api/core";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDiagnosticsReport } from "../../mocks/performanceIpcMock";
import { DiagnosticsSettings } from "./DiagnosticsSettings";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const writeText = vi.fn();

describe("DiagnosticsSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoke).mockResolvedValue(createMockDiagnosticsReport() as never);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    writeText.mockResolvedValue(undefined);
  });

  it("copies a diagnostics markdown report to the clipboard", async () => {
    render(<DiagnosticsSettings />);

    fireEvent.click(screen.getByRole("button", { name: "診断情報をコピー" }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(invoke).toHaveBeenCalledWith("collect_diagnostics");
    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain("# Mint Diagnostics");
    expect(copied).toContain("Commit SHA");
    expect(
      await screen.findByText("診断情報をコピーしました。"),
    ).toBeInTheDocument();
  });

  it("shows a summary of collected data", async () => {
    render(<DiagnosticsSettings />);

    fireEvent.click(screen.getByRole("button", { name: "診断情報をコピー" }));

    expect(
      await screen.findByText(
        "計測イベント 1 件、カウンター 3 件、保存データ 57 件",
      ),
    ).toBeInTheDocument();
  });

  it("reports failures without copying", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("native error") as never);
    render(<DiagnosticsSettings />);

    fireEvent.click(screen.getByRole("button", { name: "診断情報をコピー" }));

    expect(
      await screen.findByText("診断情報を取得できませんでした: native error"),
    ).toBeInTheDocument();
    expect(writeText).not.toHaveBeenCalled();
  });
});
