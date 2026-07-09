import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeatureCard } from "./FeatureCard";

describe("FeatureCard", () => {
  it("exposes the title as the card's accessible name", () => {
    render(
      <FeatureCard
        title="音声入力 (Voice to Text)"
        description="文字起こしの設定"
        status="利用可能"
        statusTone="available"
      >
        <button type="button">詳細設定</button>
      </FeatureCard>,
    );

    expect(
      screen.getByRole("region", { name: "音声入力 (Voice to Text)" }),
    ).toBeInTheDocument();
  });
});
