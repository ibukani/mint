import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppSettingsProvider } from "../../../core/context/AppSettings";
import { ClockSettings } from "./ClockSettings";

describe("ClockSettings component", () => {
  it("renders setting fields with default values from mock", async () => {
    render(
      <AppSettingsProvider>
        <ClockSettings />
      </AppSettingsProvider>,
    );

    // モックから設定データがロードされるまで待機
    await waitFor(() => {
      expect(screen.getByText("時計オーバーレイ設定")).toBeInTheDocument();
    });

    // 起動ショートカットキーの入力フィールド検証
    const inputs = screen.getAllByRole("textbox");
    const shortcutInput = inputs[0] as HTMLInputElement;
    expect(shortcutInput.value).toBe("Ctrl+Alt+C");

    // 表示秒数の入力フィールド検証 (type="number" は spinbutton ロールを持つ)
    const secondsInput = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(secondsInput.value).toBe("3");
  });
});
