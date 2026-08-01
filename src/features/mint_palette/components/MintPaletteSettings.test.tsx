import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppSettingsProvider } from "../../../core/context/AppSettings";
import { MintPaletteSettings } from "./MintPaletteSettings";

describe("MintPaletteSettings", () => {
  it("uses the shared feature controls and records its shortcut", async () => {
    render(
      <AppSettingsProvider>
        <MintPaletteSettings />
      </AppSettingsProvider>,
    );

    await screen.findByRole("heading", {
      name: "MintPalette 設定",
      level: 2,
    });

    const enabled = screen.getByRole("switch", {
      name: "MintPaletteを有効にする",
    });
    const shortcut = screen.getByLabelText("起動ショートカットキー");

    expect(enabled).not.toBeChecked();
    expect(shortcut).toHaveValue("Ctrl+Alt+M");

    fireEvent.click(enabled);
    expect(enabled).toBeChecked();

    fireEvent.focus(shortcut);
    fireEvent.keyDown(shortcut, {
      key: "p",
      ctrlKey: true,
      shiftKey: true,
    });

    expect(shortcut).toHaveValue("Ctrl+Shift+P");
  });

  it("restores the default shortcut", async () => {
    render(
      <AppSettingsProvider>
        <MintPaletteSettings />
      </AppSettingsProvider>,
    );

    const shortcut = await screen.findByLabelText("起動ショートカットキー");
    fireEvent.focus(shortcut);
    fireEvent.keyDown(shortcut, { key: "p", altKey: true });
    expect(shortcut).toHaveValue("Alt+P");

    fireEvent.click(screen.getByRole("button", { name: "デフォルトに戻す" }));

    await waitFor(() => expect(shortcut).toHaveValue("Ctrl+Alt+M"));
  });
});
