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
    canRetryDuplicate: false,
    close: vi.fn(),
    closeActiveTab: vi.fn(),
    cycleTab: vi.fn(),
    content: "保存できなかった入力",
    draft: { content: "保存できなかった入力", tags: "" },
    duplicateActive: vi.fn(),
    error: "保存に失敗しました",
    focusSequence: 0,
    notes: [],
    openNotes: [],
    openDraft: vi.fn(),
    pinned: false,
    removeActive: vi.fn(),
    removeNote: vi.fn(),
    removeAttachment: vi.fn(),
    retryDuplicate: vi.fn(),
    retrySave: mocks.retrySave,
    selectNote: vi.fn(),
    setContent: vi.fn(),
    setPinned: vi.fn(),
    setTitle: vi.fn(),
    setWindowPinned: vi.fn(),
    setTags: vi.fn(),
    showDraft: vi.fn(),
    status: "error",
    tags: "",
    title: "",
    reload: vi.fn(),
    windowPinned: false,
    withAutoHideSuspended: async <Result,>(operation: () => Promise<Result>) =>
      operation(),
  }),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock("../../../core/context/AppSettings", () => ({
  useSettings: () => undefined,
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
