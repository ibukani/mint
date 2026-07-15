import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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

    // 有効化チェックボックス検証
    const enabledCheckbox = screen.getByLabelText(
      "時計オーバーレイを有効にする",
    ) as HTMLInputElement;
    expect(enabledCheckbox.checked).toBe(true);

    // 起動ショートカットキーの入力フィールド検証
    const inputs = screen.getAllByRole("textbox");
    const shortcutInput = inputs[0] as HTMLInputElement;
    expect(shortcutInput.value).toBe("Alt+Left");

    // 表示秒数の入力フィールド検証
    const secondsInput = screen.getByLabelText(
      "表示秒数 (0でトグル表示)",
    ) as HTMLInputElement;
    expect(secondsInput.value).toBe("3");

    const showDateCheckbox = screen.getByLabelText(
      "年月日と曜日を表示する",
    ) as HTMLInputElement;
    expect(showDateCheckbox.checked).toBe(true);

    const sizePercentInput = screen.getByLabelText(
      "時計のサイズ倍率",
    ) as HTMLInputElement;
    expect(sizePercentInput.value).toBe("100");

    const displayModeSelect = screen.getByLabelText(
      "表示モード",
    ) as HTMLSelectElement;
    expect(displayModeSelect.value).toBe("digital");

    const hourFormatSelect = screen.getByLabelText(
      "時間表記 (デジタル時のみ)",
    ) as HTMLSelectElement;
    expect(hourFormatSelect.value).toBe("24h");

    const glowEffectCheckbox = screen.getByLabelText(
      "ネオングロー効果を有効にする",
    ) as HTMLInputElement;
    expect(glowEffectCheckbox.checked).toBe(true);
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

    const enabledCheckbox = screen.getByLabelText(
      "時計オーバーレイを有効にする",
    ) as HTMLInputElement;
    const shortcutInput = screen.getByLabelText(
      "起動ショートカットキー",
    ) as HTMLInputElement;
    const secondsInput = screen.getByLabelText(
      "表示秒数 (0でトグル表示)",
    ) as HTMLInputElement;
    const showDateCheckbox = screen.getByLabelText(
      "年月日と曜日を表示する",
    ) as HTMLInputElement;
    const showSecondsCheckbox = screen.getByLabelText(
      "秒数を表示する",
    ) as HTMLInputElement;
    const blinkColonCheckbox = screen.getByLabelText(
      "コロンを点滅させる",
    ) as HTMLInputElement;
    const sizePercentInput = screen.getByLabelText(
      "時計のサイズ倍率",
    ) as HTMLInputElement;
    const displayModeSelect = screen.getByLabelText(
      "表示モード",
    ) as HTMLSelectElement;
    const hourFormatSelect = screen.getByLabelText(
      "時間表記 (デジタル時のみ)",
    ) as HTMLSelectElement;
    const glowEffectCheckbox = screen.getByLabelText(
      "ネオングロー効果を有効にする",
    ) as HTMLInputElement;

    await act(async () => {
      fireEvent.click(enabledCheckbox); // 有効をオフにする
      fireEvent.change(shortcutInput, { target: { value: "Ctrl+Shift+T" } });
      fireEvent.change(secondsInput, { target: { value: "12" } });
      fireEvent.click(showDateCheckbox);
      fireEvent.click(showSecondsCheckbox);
      fireEvent.click(blinkColonCheckbox);
      fireEvent.change(sizePercentInput, { target: { value: "150" } });
      fireEvent.change(displayModeSelect, { target: { value: "analog" } });
      fireEvent.click(glowEffectCheckbox);
      fireEvent.click(screen.getByRole("button", { name: "デフォルトに戻す" }));
      await Promise.resolve();
    });

    expect(enabledCheckbox.checked).toBe(true);
    expect(shortcutInput.value).toBe("Alt+Left");
    expect(secondsInput.value).toBe("3");
    expect(showDateCheckbox.checked).toBe(true);
    expect(showSecondsCheckbox.checked).toBe(true);
    expect(blinkColonCheckbox.checked).toBe(true);
    expect(sizePercentInput.value).toBe("100");
    expect(displayModeSelect.value).toBe("digital");
    expect(hourFormatSelect.value).toBe("24h");
    expect(glowEffectCheckbox.checked).toBe(true);
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

    const secondsInput = screen.getByLabelText(
      "表示秒数 (0でトグル表示)",
    ) as HTMLInputElement;

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

    const secondsInput = screen.getByLabelText(
      "表示秒数 (0でトグル表示)",
    ) as HTMLInputElement;
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

    const secondsInput = screen.getByLabelText(
      "表示秒数 (0でトグル表示)",
    ) as HTMLInputElement;
    const increaseButton = screen.getByRole("button", {
      name: "表示秒数を1秒増やす",
    });

    fireEvent.click(increaseButton);

    expect(secondsInput.value).toBe("4");
    expect(secondsInput).toHaveFocus();
  });

  it("records shortcut key combination on key down", async () => {
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

    await act(async () => {
      fireEvent.focus(shortcutInput);
      fireEvent.keyDown(shortcutInput, {
        key: "t",
        ctrlKey: true,
        shiftKey: true,
      });
      await Promise.resolve();
    });

    expect(shortcutInput.value).toBe("Ctrl+Shift+T");
  });
});
