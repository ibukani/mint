import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppLoading } from "./AppLoading";

describe("AppLoading", () => {
  it("uses an informative compact state for lazy settings screens", () => {
    render(<AppLoading compact />);

    const status = screen.getByRole("status");
    expect(status).toHaveClass("app-loading--compact");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("設定画面を準備しています")).toBeInTheDocument();
  });
});
