import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppSettingsProvider } from "../../../core/context/AppSettings";
import { CalendarSettings } from "./CalendarSettings";

describe("CalendarSettings", () => {
  it("renders the enabled default and Alt+Down shortcut", async () => {
    render(
      <AppSettingsProvider>
        <CalendarSettings />
      </AppSettingsProvider>,
    );

    await screen.findByRole("heading", { name: "カレンダー設定" });
    expect(screen.getByLabelText("カレンダーを有効にする")).toBeChecked();
    expect(screen.getByLabelText("起動ショートカットキー")).toHaveValue(
      "Alt+Down",
    );
    expect(screen.getByLabelText("予定登録ショートカットキー")).toHaveValue(
      "Alt+Up",
    );
  });

  it("records an arrow shortcut and resets defaults", async () => {
    render(
      <AppSettingsProvider>
        <CalendarSettings />
      </AppSettingsProvider>,
    );

    await screen.findByRole("heading", { name: "カレンダー設定" });
    const shortcut = screen.getByLabelText("起動ショートカットキー");
    fireEvent.focus(shortcut);
    fireEvent.keyDown(shortcut, { key: "ArrowRight", altKey: true });
    expect(shortcut).toHaveValue("Alt+Right");

    fireEvent.click(screen.getByRole("button", { name: "デフォルトに戻す" }));
    await waitFor(() => expect(shortcut).toHaveValue("Alt+Down"));
    expect(screen.getByLabelText("予定登録ショートカットキー")).toHaveValue(
      "Alt+Up",
    );
  });
});
