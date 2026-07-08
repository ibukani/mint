import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("resets clock settings to defaults", async () => {
    render(
      <AppSettingsProvider>
        <ClockSettings />
      </AppSettingsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("時計オーバーレイ設定")).toBeInTheDocument();
    });

    const shortcutInput = screen.getByLabelText(
      "起動ショートカットキー",
    ) as HTMLInputElement;
    const secondsInput = screen.getByRole("spinbutton") as HTMLInputElement;
    const fontSizeSelect = screen.getByLabelText(
      "フォントサイズ",
    ) as HTMLSelectElement;

    fireEvent.change(shortcutInput, { target: { value: "Ctrl+Shift+T" } });
    fireEvent.change(secondsInput, { target: { value: "12" } });
    fireEvent.change(fontSizeSelect, { target: { value: "2.5rem" } });

    fireEvent.click(screen.getByRole("button", { name: "デフォルトに戻す" }));

    expect(shortcutInput.value).toBe("Ctrl+Alt+C");
    expect(secondsInput.value).toBe("3");
    expect(fontSizeSelect.value).toBe("1.5rem");
  });

  it("keeps auto-hide seconds within the supported range", async () => {
    render(
      <AppSettingsProvider>
        <ClockSettings />
      </AppSettingsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("時計オーバーレイ設定")).toBeInTheDocument();
    });

    const secondsInput = screen.getByRole("spinbutton") as HTMLInputElement;

    fireEvent.change(secondsInput, { target: { value: "999" } });
    expect(secondsInput.value).toBe("60");

    fireEvent.change(secondsInput, { target: { value: "-5" } });
    expect(secondsInput.value).toBe("0");
  });
});
