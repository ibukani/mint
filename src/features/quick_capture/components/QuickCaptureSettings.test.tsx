import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppSettingsProvider } from "../../../core/context/AppSettings";
import { QuickCaptureSettings } from "./QuickCaptureSettings";

describe("QuickCaptureSettings", () => {
  it("uses the shared feature controls and records its shortcut", async () => {
    render(
      <AppSettingsProvider>
        <QuickCaptureSettings />
      </AppSettingsProvider>,
    );

    await screen.findByRole("heading", {
      name: "クイックキャプチャー設定",
      level: 2,
    });

    const enabled = screen.getByRole("switch", {
      name: "クイックキャプチャーを有効にする",
    });
    const shortcut = screen.getByLabelText("起動ショートカットキー");

    expect(enabled).toBeChecked();
    expect(shortcut).toHaveValue("Alt+2");

    fireEvent.focus(shortcut);
    fireEvent.keyDown(shortcut, {
      key: "q",
      ctrlKey: true,
      shiftKey: true,
    });

    expect(shortcut).toHaveValue("Ctrl+Shift+Q");
    expect(screen.getByText("このPCにローカル保存")).toBeInTheDocument();
  });

  it("restores the default shortcut", async () => {
    render(
      <AppSettingsProvider>
        <QuickCaptureSettings />
      </AppSettingsProvider>,
    );

    const shortcut = await screen.findByLabelText("起動ショートカットキー");
    fireEvent.focus(shortcut);
    fireEvent.keyDown(shortcut, { key: "q", altKey: true });
    expect(shortcut).toHaveValue("Alt+Q");

    fireEvent.click(screen.getByRole("button", { name: "デフォルトに戻す" }));

    await waitFor(() => expect(shortcut).toHaveValue("Alt+2"));
  });
});
