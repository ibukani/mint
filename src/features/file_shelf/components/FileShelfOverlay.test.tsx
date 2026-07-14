import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFileShelf } from "../hooks/useFileShelf";
import type { FileShelfItem } from "../types";
import { FileShelfOverlay } from "./FileShelfOverlay";

vi.mock("../hooks/useFileShelf", () => ({ useFileShelf: vi.fn() }));

const first: FileShelfItem = {
  id: "first",
  groupId: "group",
  kind: "file",
  displayName: "report.pdf",
  sourcePath: "C:\\Work\\report.pdf",
  textContent: null,
  mimeType: null,
  sizeBytes: 2048,
  createdAt: "2026-07-13T00:00:00Z",
  availability: "ready",
  source: "manual",
};

const second: FileShelfItem = {
  ...first,
  id: "second",
  kind: "folder",
  displayName: "assets",
  sourcePath: "C:\\Work\\assets",
  sizeBytes: null,
};

const urlItem: FileShelfItem = {
  ...first,
  id: "url",
  groupId: "url-group",
  kind: "url",
  displayName: "example.com",
  sourcePath: null,
  textContent: "https://example.com/docs",
  mimeType: "text/uri-list",
  sizeBytes: null,
};

const actions = {
  changeExpanded: vi.fn(),
  addPaths: vi.fn(),
  addContent: vi.fn(),
  choosePaths: vi.fn(),
  removeItems: vi.fn(),
  clear: vi.fn(),
  undo: vi.fn(),
  dragItems: vi.fn(),
  copyItem: vi.fn(),
  copyItems: vi.fn(),
  openItem: vi.fn(),
  revealItem: vi.fn(),
  clearClipboardHistory: vi.fn(),
};

const expandedShelf = () => ({
  state: {
    groups: [
      {
        id: "group",
        createdAt: "2026-07-13T00:00:00Z",
        items: [first, second],
      },
    ],
  },
  expanded: true,
  loading: false,
  busy: false,
  error: "",
  notice: "",
  undoToken: "",
  isDropTarget: false,
  itemCount: 2,
  clipboardHistoryCount: 0,
  reportError: vi.fn(),
  ...actions,
});

describe("FileShelfOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useFileShelf).mockReturnValue(expandedShelf());
  });

  it("shows a grouped stack and exposes native drag interaction", () => {
    render(<FileShelfOverlay />);

    expect(screen.getByText("2件のスタック")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /2件のスタック/ }));
    expect(screen.getByText("report.pdf")).toBeInTheDocument();
    expect(screen.getByText("assets")).toBeInTheDocument();

    fireEvent.pointerDown(
      screen.getByRole("button", {
        name: "スタックをドラッグして取り出す",
      }),
      { button: 0, shiftKey: true },
    );
    expect(actions.dragItems).toHaveBeenCalledWith([first, second], true);
  });

  it("shows a clear drop target state while files are being dragged in", () => {
    vi.mocked(useFileShelf).mockReturnValue({
      ...expandedShelf(),
      isDropTarget: true,
    });
    render(<FileShelfOverlay />);

    const shelf = screen.getByRole("region", { name: "ファイルシェル" });
    const pasteZone = screen.getByRole("status");
    expect(shelf).toHaveClass("is-drop-target");
    expect(pasteZone).toHaveClass("is-drop-target");
    expect(pasteZone).toHaveTextContent("ここにドロップしてファイルを追加");
  });

  it("supports paste and keyboard selection removal", () => {
    render(<FileShelfOverlay />);
    const shelf = screen.getByRole("region", { name: "ファイルシェル" });
    fireEvent.paste(shelf, {
      clipboardData: {
        items: [],
        getData: () => "https://example.com/docs",
      },
    });
    expect(actions.addContent).toHaveBeenCalledWith({
      kind: "url",
      url: "https://example.com/docs",
    });

    fireEvent.keyDown(shelf, { key: "a", ctrlKey: true });
    expect(screen.getByText("2件を選択")).toBeInTheDocument();
    fireEvent.keyDown(shelf, { key: "c", ctrlKey: true });
    expect(actions.copyItems).toHaveBeenCalledWith([first, second]);
    fireEvent.keyDown(shelf, { key: "Delete" });
    expect(actions.removeItems).toHaveBeenCalledWith(["first", "second"]);
  });

  it("searches, navigates, and opens shelf items from the keyboard", () => {
    vi.mocked(useFileShelf).mockReturnValue({
      ...expandedShelf(),
      state: {
        groups: [
          {
            id: "group",
            createdAt: "2026-07-13T00:00:00Z",
            items: [first, second],
          },
          {
            id: "url-group",
            createdAt: "2026-07-13T00:00:00Z",
            items: [urlItem],
          },
        ],
      },
      itemCount: 3,
    });
    render(<FileShelfOverlay />);

    const shelf = screen.getByRole("region", { name: "ファイルシェル" });
    fireEvent.keyDown(shelf, { key: "f", ctrlKey: true });

    const search = screen.getByRole("searchbox", { name: "棚を検索" });
    expect(search).toHaveFocus();
    fireEvent.change(search, { target: { value: "assets" } });
    expect(screen.getByText("1件")).toBeInTheDocument();
    expect(screen.getByText("assets")).toBeInTheDocument();
    expect(screen.queryByText("report.pdf")).not.toBeInTheDocument();

    fireEvent.keyDown(search, { key: "Enter" });
    expect(actions.openItem).toHaveBeenCalledWith(second);

    fireEvent.keyDown(search, { key: "Escape" });
    expect(search).toHaveValue("");
    expect(actions.changeExpanded).not.toHaveBeenCalled();
    fireEvent.keyDown(search, { key: "Escape" });
    expect(actions.changeExpanded).not.toHaveBeenCalled();
    fireEvent.keyDown(shelf, { key: "Escape" });
    expect(actions.changeExpanded).toHaveBeenCalledWith(false);
  });

  it("moves five shelf items at a time with PageUp and PageDown", () => {
    const items = Array.from({ length: 8 }, (_, index) => ({
      ...first,
      id: `item-${index}`,
      groupId: `group-${index}`,
      displayName: `file-${index}.txt`,
    }));
    vi.mocked(useFileShelf).mockReturnValue({
      ...expandedShelf(),
      state: {
        groups: items.map((item) => ({
          id: item.groupId,
          createdAt: item.createdAt,
          items: [item],
        })),
      },
      itemCount: items.length,
    });
    render(<FileShelfOverlay />);

    const search = screen.getByRole("searchbox", { name: "棚を検索" });
    expect(search).toHaveAttribute(
      "aria-keyshortcuts",
      "Control+F ArrowDown ArrowUp Home End PageUp PageDown Enter Escape",
    );
    expect(
      screen.getByText("↑↓: 1件 · PgUp/PgDn: 5件 · Home/End · Shiftで移動"),
    ).toBeInTheDocument();

    fireEvent.keyDown(search, { key: "PageDown" });
    expect(
      screen.getByRole("button", { name: /file-5\.txt.*ファイル/ }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.keyDown(search, { key: "PageUp" });
    expect(
      screen.getByRole("button", { name: /file-0\.txt.*ファイル/ }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps native editing and paste behavior inside the search field", () => {
    render(<FileShelfOverlay />);

    const shelf = screen.getByRole("region", { name: "ファイルシェル" });
    fireEvent.keyDown(shelf, { key: "f", ctrlKey: true });
    const search = screen.getByRole("searchbox", { name: "棚を検索" });

    fireEvent.keyDown(search, { key: "a", ctrlKey: true });
    fireEvent.keyDown(search, { key: "c", ctrlKey: true });
    fireEvent.paste(search, {
      clipboardData: {
        items: [],
        getData: () => "pasted into search",
      },
    });

    expect(screen.queryByText("2件を選択")).not.toBeInTheDocument();
    expect(actions.addContent).not.toHaveBeenCalled();
    expect(actions.copyItem).not.toHaveBeenCalled();
    expect(actions.copyItems).not.toHaveBeenCalled();
  });

  it("moves to the last visible item and copies it with platform shortcuts", () => {
    vi.mocked(useFileShelf).mockReturnValue({
      ...expandedShelf(),
      state: {
        groups: [
          {
            id: "group",
            createdAt: "2026-07-13T00:00:00Z",
            items: [first, second],
          },
          {
            id: "url-group",
            createdAt: "2026-07-13T00:00:00Z",
            items: [urlItem],
          },
        ],
      },
      itemCount: 3,
    });
    render(<FileShelfOverlay />);

    const shelf = screen.getByRole("region", { name: "ファイルシェル" });
    fireEvent.keyDown(shelf, { key: "End" });
    fireEvent.keyDown(shelf, { key: "c", ctrlKey: true });

    expect(actions.copyItem).toHaveBeenCalledWith(urlItem);
  });

  it("reveals an unchanged cursor again when selection actions reduce the list", () => {
    const rect = (top: number, bottom: number) =>
      ({
        top,
        bottom,
        left: 0,
        right: 320,
        width: 320,
        height: bottom - top,
        x: 0,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect;
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this.classList.contains("file-shelf__content")) {
          return rect(0, 100);
        }
        if (this.dataset.shelfCursorKey === "item:url") {
          return rect(120, 170);
        }
        return rect(0, 40);
      });
    vi.mocked(useFileShelf).mockReturnValue({
      ...expandedShelf(),
      state: {
        groups: [
          {
            id: "first-group",
            createdAt: "2026-07-13T00:00:00Z",
            items: [first],
          },
          {
            id: "url-group",
            createdAt: "2026-07-13T00:00:00Z",
            items: [urlItem],
          },
        ],
      },
      itemCount: 2,
    });
    render(<FileShelfOverlay />);

    const shelf = screen.getByRole("region", { name: "ファイルシェル" });
    fireEvent.keyDown(shelf, { key: "f", ctrlKey: true });
    const search = screen.getByRole("searchbox", { name: "棚を検索" });
    fireEvent.change(search, { target: { value: "example" } });
    fireEvent.keyDown(search, { key: "Escape" });

    const content = document.querySelector<HTMLElement>(".file-shelf__content");
    expect(content).not.toBeNull();
    if (!content) return;
    content.scrollTop = 0;
    fireEvent.keyDown(search, { key: "End" });

    expect(content.scrollTop).toBe(78);
    rectSpy.mockRestore();
  });

  it("renders a compact count handle while collapsed", () => {
    vi.mocked(useFileShelf).mockReturnValue({
      ...expandedShelf(),
      expanded: false,
      itemCount: 3,
    });
    render(<FileShelfOverlay />);
    fireEvent.click(
      screen.getByRole("button", { name: "ファイルシェルを開く、3件" }),
    );
    expect(actions.changeExpanded).toHaveBeenCalledWith(true);
  });

  it("keeps pasted URLs on the safe copy path on Windows", () => {
    vi.mocked(useFileShelf).mockReturnValue({
      ...expandedShelf(),
      state: {
        groups: [
          {
            id: "url-group",
            createdAt: "2026-07-13T00:00:00Z",
            items: [urlItem],
          },
        ],
      },
      itemCount: 1,
    });
    render(<FileShelfOverlay />);

    expect(
      screen.getByRole("button", {
        name: "example.comをドラッグして取り出す",
      }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /example.com.*URL/ }));
    fireEvent.click(screen.getByRole("button", { name: "選択項目をコピー" }));
    expect(actions.copyItem).toHaveBeenCalledWith(urlItem);
  });

  it("restores the latest removal with the platform undo shortcut", () => {
    vi.mocked(useFileShelf).mockReturnValue({
      ...expandedShelf(),
      undoToken: "undo-token",
    });
    render(<FileShelfOverlay />);

    fireEvent.keyDown(screen.getByRole("region", { name: "ファイルシェル" }), {
      key: "z",
      ctrlKey: true,
    });

    expect(actions.undo).toHaveBeenCalledOnce();
  });

  it("marks clipboard history and can clear only that history", () => {
    const historyItem: FileShelfItem = {
      ...urlItem,
      source: "clipboardHistory",
    };
    vi.mocked(useFileShelf).mockReturnValue({
      ...expandedShelf(),
      state: {
        groups: [
          {
            id: "url-group",
            createdAt: "2026-07-13T00:00:00Z",
            items: [historyItem],
          },
        ],
      },
      itemCount: 1,
      clipboardHistoryCount: 1,
    });
    render(<FileShelfOverlay />);

    expect(screen.getByText("履歴 · URL")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "クリップボード履歴だけを消去",
      }),
    );
    expect(actions.clearClipboardHistory).toHaveBeenCalledOnce();
  });
});
