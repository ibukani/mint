import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";
import { Field } from "./Field";
import { FieldRow } from "./FieldRow";
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

  it("connects help and error text through a compound field row", () => {
    render(
      <Field
        id="compound-input"
        label="APIキー"
        helpText="安全に保存されます"
        error="APIキーが必要です"
      >
        <FieldRow>
          <TextInput id="compound-input" type="password" value="" readOnly />
          <Button aria-label="表示">表示</Button>
        </FieldRow>
      </Field>,
    );

    expect(screen.getByLabelText("APIキー")).toHaveAttribute(
      "aria-describedby",
      "compound-input-error compound-input-help",
    );
  });
});
