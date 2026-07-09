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

    const showDateCheckbox = screen.getByLabelText(
      "年月日と曜日を表示する",
    ) as HTMLInputElement;
    expect(showDateCheckbox.checked).toBe(true);
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
    const showDateCheckbox = screen.getByLabelText(
      "年月日と曜日を表示する",
    ) as HTMLInputElement;

    fireEvent.change(shortcutInput, { target: { value: "Ctrl+Shift+T" } });
    fireEvent.change(secondsInput, { target: { value: "12" } });
    fireEvent.change(fontSizeSelect, { target: { value: "2.5rem" } });
    fireEvent.click(showDateCheckbox);

    fireEvent.click(screen.getByRole("button", { name: "デフォルトに戻す" }));

    expect(shortcutInput.value).toBe("Ctrl+Alt+C");
    expect(secondsInput.value).toBe("3");
    expect(fontSizeSelect.value).toBe("1.5rem");
    expect(showDateCheckbox.checked).toBe(true);
  });

  it("returns focus to the shortcut field after resetting", async () => {
    render(
      <AppSettingsProvider>
        <ClockSettings />
      </AppSettingsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("時計オーバーレイ設定")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "デフォルトに戻す" }));

    const shortcutInput = screen.getByLabelText(
      "起動ショートカットキー",
    ) as HTMLInputElement;
    expect(shortcutInput).toHaveFocus();
    expect(shortcutInput.selectionStart).toBe(0);
    expect(shortcutInput.selectionEnd).toBe(shortcutInput.value.length);
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

  it("adjusts auto-hide seconds with step buttons", async () => {
    render(
      <AppSettingsProvider>
        <ClockSettings />
      </AppSettingsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("時計オーバーレイ設定")).toBeInTheDocument();
    });

    const secondsInput = screen.getByRole("spinbutton") as HTMLInputElement;
    const decreaseButton = screen.getByRole("button", {
      name: "表示秒数を1秒減らす",
    });
    const increaseButton = screen.getByRole("button", {
      name: "表示秒数を1秒増やす",
    });

    fireEvent.click(decreaseButton);
    expect(secondsInput.value).toBe("2");

    fireEvent.click(increaseButton);
    fireEvent.click(increaseButton);
    expect(secondsInput.value).toBe("4");
  });

  it("returns focus to the seconds field after using step buttons", async () => {
    render(
      <AppSettingsProvider>
        <ClockSettings />
      </AppSettingsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("時計オーバーレイ設定")).toBeInTheDocument();
    });

    const secondsInput = screen.getByRole("spinbutton") as HTMLInputElement;
    const increaseButton = screen.getByRole("button", {
      name: "表示秒数を1秒増やす",
    });

    fireEvent.click(increaseButton);

    expect(secondsInput.value).toBe("4");
    expect(secondsInput).toHaveFocus();
  });

  it("trims shortcut whitespace when leaving the field", async () => {
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

    fireEvent.change(shortcutInput, { target: { value: "  Ctrl+Shift+T  " } });
    fireEvent.blur(shortcutInput);

    expect(shortcutInput.value).toBe("Ctrl+Shift+T");
  });
});
