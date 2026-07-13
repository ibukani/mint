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
  openItem: vi.fn(),
  revealItem: vi.fn(),
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
  itemCount: 2,
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
    fireEvent.keyDown(shelf, { key: "Delete" });
    expect(actions.removeItems).toHaveBeenCalledWith(["first", "second"]);
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
});
