import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppSettingsProvider } from "../../../core/context/AppSettings";
import { FileShelfSettings } from "./FileShelfSettings";

describe("FileShelfSettings", () => {
  it("shows the Windows-first defaults and updates the edge", async () => {
    render(
      <AppSettingsProvider>
        <FileShelfSettings />
      </AppSettingsProvider>,
    );

    await screen.findByRole("heading", { name: "ファイルシェル", level: 2 });
    expect(
      screen.getByRole("switch", { name: "ファイルシェルを有効にする" }),
    ).toBeChecked();
    expect(screen.getByLabelText("起動ショートカットキー")).toHaveValue(
      "Alt+3",
    );
    expect(screen.getByLabelText("表示する側")).toHaveValue("right");

    await act(async () => {
      fireEvent.change(screen.getByLabelText("表示する側"), {
        target: { value: "left" },
      });
    });
    expect(screen.getByLabelText("表示する側")).toHaveValue("left");
  });

  it("restores the complete default settings", async () => {
    render(
      <AppSettingsProvider>
        <FileShelfSettings />
      </AppSettingsProvider>,
    );

    const shortcut = await screen.findByLabelText("起動ショートカットキー");
    await act(async () => {
      fireEvent.focus(shortcut);
      fireEvent.keyDown(shortcut, { key: "f", ctrlKey: true, altKey: true });
      fireEvent.change(screen.getByLabelText("表示する側"), {
        target: { value: "left" },
      });
      fireEvent.click(
        screen.getByRole("switch", { name: "ハンドルを常に表示する" }),
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "デフォルトに戻す" }));
    });

    await waitFor(() => expect(shortcut).toHaveValue("Alt+3"));
    expect(screen.getByLabelText("表示する側")).toHaveValue("right");
    expect(
      screen.getByRole("switch", { name: "ハンドルを常に表示する" }),
    ).toBeChecked();
  });
});
