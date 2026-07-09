import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Checkbox } from "./Checkbox";
import { Field } from "./Field";

describe("Checkbox", () => {
  it("renders a checkbox input with the shared checkbox styling", () => {
    render(
      <Checkbox id="sample-checkbox" checked={false} onChange={() => {}} />,
    );

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("id", "sample-checkbox");
    expect(checkbox).toHaveClass("design-checkbox");
  });

  it("supports being used inside Field with help text", () => {
    render(
      <Field id="sample-checkbox" label="サンプル" helpText="補足説明">
        <Checkbox id="sample-checkbox" checked onChange={() => {}} />
      </Field>,
    );

    expect(screen.getByLabelText("サンプル")).toHaveAttribute(
      "aria-describedby",
      "sample-checkbox-error sample-checkbox-help",
    );
    expect(screen.getByText("補足説明")).toHaveAttribute(
      "id",
      "sample-checkbox-help",
    );
  });
});
