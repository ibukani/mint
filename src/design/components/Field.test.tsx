import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "./Field";
import { TextInput } from "./TextInput";

describe("Field", () => {
  it("connects help and error text to the input", () => {
    render(
      <Field
        id="sample-input"
        label="サンプル"
        helpText="補足説明"
        error="入力エラー"
      >
        <TextInput id="sample-input" type="text" />
      </Field>,
    );

    expect(screen.getByLabelText("サンプル")).toHaveAttribute(
      "aria-describedby",
      "sample-input-error sample-input-help",
    );
    expect(screen.getByText("補足説明")).toHaveAttribute(
      "id",
      "sample-input-help",
    );
    expect(screen.getByText("入力エラー")).toHaveAttribute(
      "id",
      "sample-input-error",
    );
  });
});
