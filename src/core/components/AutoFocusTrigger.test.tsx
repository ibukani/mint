import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsSection } from "../../design/components";
import { AutoFocusTrigger } from "./AutoFocusTrigger";

describe("AutoFocusTrigger", () => {
  it("returns settings navigation to the page heading without scrolling to a field", async () => {
    const { container } = render(
      <main className="app-content">
        <SettingsSection title="時計オーバーレイ設定">
          <input aria-label="下部の設定項目" />
        </SettingsSection>
        <AutoFocusTrigger />
      </main>,
    );
    const content = container.querySelector<HTMLElement>(".app-content");
    if (!content) throw new Error("settings content was not rendered");
    content.scrollTop = 640;

    await waitFor(() => {
      expect(content.scrollTop).toBe(0);
      expect(
        screen.getByRole("heading", { name: "時計オーバーレイ設定" }),
      ).toHaveFocus();
    });
    expect(screen.getByLabelText("下部の設定項目")).not.toHaveFocus();
  });
});
