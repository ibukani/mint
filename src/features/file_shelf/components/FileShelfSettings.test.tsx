import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppSettingsProvider } from "../../../core/context/AppSettings";
import { FileShelfSettings } from "./FileShelfSettings";

const apiMocks = vi.hoisted(() => ({
  chooseIgnoredFileShelfApplication: vi.fn(),
}));

vi.mock("../api", () => ({
  chooseIgnoredFileShelfApplication: apiMocks.chooseIgnoredFileShelfApplication,
}));

describe("FileShelfSettings", () => {
  beforeEach(() => {
    apiMocks.chooseIgnoredFileShelfApplication.mockResolvedValue(null);
  });

  it("shows the Windows-first defaults and updates the edge", async () => {
    render(
      <AppSettingsProvider>
        <FileShelfSettings />
      </AppSettingsProvider>,
    );

    await screen.findByRole("heading", { name: "ファイルシェル", level: 2 });
    expect(
      screen.getByRole("switch", { name: "ファイルシェルを有効にする" }),
    ).toBeChecked();
    expect(screen.getByLabelText("起動ショートカットキー")).toHaveValue(
      "Alt+3",
    );
    expect(screen.getByLabelText("表示する側")).toHaveValue("right");
    expect(screen.getByLabelText("縦の位置")).toHaveValue("center");
    expect(
      screen.getByText(/800ms以上の長押しで最近外した項目を戻します/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", {
        name: "クリップボード履歴を保存する",
      }),
    ).not.toBeChecked();
    expect(screen.getByLabelText("履歴の保存件数")).toHaveValue("25");
    expect(screen.getByText("Bitwarden.exe")).toBeInTheDocument();
    expect(screen.getByText("KeePassXC.exe")).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(screen.getByLabelText("表示する側"), {
        target: { value: "left" },
      });
      fireEvent.change(screen.getByLabelText("縦の位置"), {
        target: { value: "cursor" },
      });
    });
    expect(screen.getByLabelText("表示する側")).toHaveValue("left");
    await waitFor(() =>
      expect(screen.getByLabelText("縦の位置")).toHaveValue("cursor"),
    );
  });

  it("adds and removes applications from automatic shelf activity", async () => {
    apiMocks.chooseIgnoredFileShelfApplication.mockResolvedValueOnce(
      "PrivateCopy.exe",
    );
    render(
      <AppSettingsProvider>
        <FileShelfSettings />
      </AppSettingsProvider>,
    );
    await screen.findByRole("heading", { name: "除外するアプリ" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "アプリを追加" }));
    });
    expect(await screen.findByText("PrivateCopy.exe")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", {
          name: "PrivateCopy.exe を除外から外す",
        }),
      );
    });
    expect(screen.queryByText("PrivateCopy.exe")).not.toBeInTheDocument();
  });

  it("restores the complete default settings", async () => {
    render(
      <AppSettingsProvider>
        <FileShelfSettings />
      </AppSettingsProvider>,
    );

    const shortcut = await screen.findByLabelText("起動ショートカットキー");
    await act(async () => {
      fireEvent.focus(shortcut);
      fireEvent.keyDown(shortcut, { key: "f", ctrlKey: true, altKey: true });
      fireEvent.change(screen.getByLabelText("表示する側"), {
        target: { value: "left" },
      });
      fireEvent.click(
        screen.getByRole("switch", { name: "ハンドルを常に表示する" }),
      );
      fireEvent.click(
        screen.getByRole("switch", {
          name: "クリップボード履歴を保存する",
        }),
      );
      fireEvent.change(screen.getByLabelText("履歴の保存件数"), {
        target: { value: "50" },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "デフォルトに戻す" }));
    });

    await waitFor(() => expect(shortcut).toHaveValue("Alt+3"));
    expect(screen.getByLabelText("表示する側")).toHaveValue("right");
    expect(screen.getByLabelText("縦の位置")).toHaveValue("center");
    expect(
      screen.getByRole("switch", { name: "ハンドルを常に表示する" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("switch", {
        name: "クリップボード履歴を保存する",
      }),
    ).not.toBeChecked();
    expect(screen.getByLabelText("履歴の保存件数")).toHaveValue("25");
  });
});
