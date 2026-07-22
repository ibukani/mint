import { describe, expect, it } from "vitest";
import { QUICK_CAPTURE_TEMPLATES } from "./templates";
import {
  continueMarkdownList,
  countLinesAndChars,
  formatMarkdownLines,
  indentMarkdownSelection,
  insertMarkdownTemplate,
  mergeTags,
  noteTitle,
  parseQuickCaptureSearch,
  parseTags,
  safeFileName,
} from "./utils";

describe("quick capture utilities", () => {
  it("extracts a useful note title", () => {
    expect(noteTitle({ content: "\n  見出し  \n本文" })).toBe("見出し");
    expect(noteTitle({ content: "\n  " })).toBe("無題のメモ");
  });

  it("counts lines and characters accurately", () => {
    expect(countLinesAndChars("")).toEqual({ lines: 0, chars: 0 });
    expect(countLinesAndChars("hello")).toEqual({ lines: 1, chars: 5 });
    expect(countLinesAndChars("line1\nline2\nline3")).toEqual({
      lines: 3,
      chars: 17,
    });
  });

  it("parses comma-separated tags", () => {
    expect(parseTags(" work,  idea ,, ")).toEqual(["work", "idea"]);
  });

  it("sanitizes markdown export names", () => {
    expect(safeFileName("  meeting/report  ")).toBe("meeting-report.md");
    expect(safeFileName(" ")).toBe("quick-capture.md");
  });

  it("continues unordered, checklist, ordered, and quote blocks", () => {
    const checklist = "- [ ] 次の作業";
    expect(
      continueMarkdownList(checklist, checklist.length, checklist.length),
    ).toEqual({
      content: "- [ ] 次の作業\n- [ ] ",
      selectionStart: 17,
      selectionEnd: 17,
    });

    const ordered = "  8. 手順";
    expect(
      continueMarkdownList(ordered, ordered.length, ordered.length)?.content,
    ).toBe("  8. 手順\n  9. ");

    const quote = "> 引用";
    expect(
      continueMarkdownList(quote, quote.length, quote.length)?.content,
    ).toBe("> 引用\n> ");
  });

  it("removes an empty list marker when the user presses Enter again", () => {
    const content = "- 項目\n- ";
    expect(
      continueMarkdownList(content, content.length, content.length),
    ).toEqual({
      content: "- 項目\n",
      selectionStart: 5,
      selectionEnd: 5,
    });
  });

  it("indents and outdents every selected Markdown line", () => {
    const content = "項目1\n項目2";
    const indented = indentMarkdownSelection(content, 0, content.length);
    expect(indented.content).toBe("  項目1\n  項目2");
    expect(indented.selectionStart).toBe(2);
    expect(indented.selectionEnd).toBe(content.length + 4);

    const outdented = indentMarkdownSelection(
      indented.content,
      2,
      indented.selectionEnd,
      true,
    );
    expect(outdented.content).toBe(content);
  });

  it("does not continue a list when the caret is in the middle of a line", () => {
    expect(continueMarkdownList("- 項目", 3, 3)).toBeNull();
  });

  it("inserts a template as a separate block and merges its tags", () => {
    const template = QUICK_CAPTURE_TEMPLATES[0];
    const content = "既存のメモ";
    const edit = insertMarkdownTemplate(
      content,
      content.length,
      content.length,
      template,
    );
    expect(edit.content).toBe("既存のメモ\n\n## タスク\n\n- [ ] ");
    expect(mergeTags("work, task", template.tags)).toBe("work, task");
    expect(mergeTags("work", ["idea", " work "])).toBe("work, idea");
  });

  it("parses advanced library search operators without losing text terms", () => {
    expect(
      parseQuickCaptureSearch(
        "tag:Work is:pinned is:archived has:attachments review",
      ),
    ).toEqual({
      text: "review",
      tag: "Work",
      pinnedOnly: true,
      attachmentsOnly: true,
      archivedOnly: true,
    });
  });

  it("applies and toggles a block prefix across selected lines", () => {
    const content = "一つ目\n二つ目";
    const formatted = formatMarkdownLines(content, 0, content.length, "- ");
    expect(formatted.content).toBe("- 一つ目\n- 二つ目");
    expect(
      formatMarkdownLines(
        formatted.content,
        formatted.selectionStart,
        formatted.selectionEnd,
        "- ",
      ).content,
    ).toBe(content);
    expect(formatMarkdownLines("- 作業", 0, 0, "- [ ] ").content).toBe(
      "- [ ] 作業",
    );
  });
});
