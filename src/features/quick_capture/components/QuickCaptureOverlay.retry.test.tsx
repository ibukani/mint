import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  retrySave: vi.fn(),
}));

vi.mock("../hooks/useQuickCapture", () => ({
  useQuickCapture: () => ({
    activeId: null,
    addAttachment: vi.fn(),
    allTags: [],
    canRetrySave: true,
    close: vi.fn(),
    content: "保存できなかった入力",
    draft: { content: "保存できなかった入力", tags: "" },
    error: "保存に失敗しました",
    exportBackup: vi.fn(),
    focusSequence: 0,
    importBackup: vi.fn(),
    notes: [],
    openDraft: vi.fn(),
    pinned: false,
    promote: vi.fn(),
    removeActive: vi.fn(),
    removeAttachment: vi.fn(),
    retrySave: mocks.retrySave,
    selectNote: vi.fn(),
    setContent: vi.fn(),
    setPinned: vi.fn(),
    setTags: vi.fn(),
    showDraft: vi.fn(),
    status: "error",
    tags: "",
    reload: vi.fn(),
  }),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openPath: vi.fn(),
  openUrl: vi.fn(),
}));

import { QuickCaptureOverlay } from "./QuickCaptureOverlay";

describe("QuickCaptureOverlay save recovery", () => {
  beforeEach(() => mocks.retrySave.mockClear());

  it("shows a retry action for a failed save and invokes it", () => {
    render(<QuickCaptureOverlay />);

    const retry = screen.getByRole("button", { name: "再試行" });
    expect(retry).toHaveAttribute("title", "保存を再試行");

    fireEvent.click(retry);

    expect(mocks.retrySave).toHaveBeenCalledOnce();
  });
});
