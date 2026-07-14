import type { DownloadEvent, Update } from "@tauri-apps/plugin-updater";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpdaterSettings } from "./UpdaterSettings";

const updaterMocks = vi.hoisted(() => ({
  check: vi.fn(),
  relaunch: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: updaterMocks.check,
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: updaterMocks.relaunch,
}));

const createUpdate = () => {
  const downloadAndInstall = vi.fn(
    async (onEvent?: (event: DownloadEvent) => void) => {
      onEvent?.({ event: "Started", data: { contentLength: 100 } });
      onEvent?.({ event: "Progress", data: { chunkLength: 40 } });
      onEvent?.({ event: "Progress", data: { chunkLength: 60 } });
      onEvent?.({ event: "Finished" });
    },
  );
  const update = {
    currentVersion: "0.1.0",
    version: "0.2.0",
    date: "2026-07-10T00:00:00Z",
    body: "操作性を改善しました。",
    downloadAndInstall,
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as Update;

  return { update, downloadAndInstall };
};

describe("UpdaterSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updaterMocks.check.mockResolvedValue(null);
    updaterMocks.relaunch.mockResolvedValue(undefined);
  });

  it("checks manually and reports when the app is up to date", async () => {
    render(<UpdaterSettings />);

    fireEvent.click(screen.getByRole("button", { name: "更新を確認" }));

    expect(await screen.findByText("最新バージョンです")).toBeInTheDocument();
    expect(updaterMocks.check).toHaveBeenCalledWith({ timeout: 15_000 });
  });

  it("shows version details and release notes for an available update", async () => {
    const { update } = createUpdate();
    updaterMocks.check.mockResolvedValue(update);
    render(<UpdaterSettings />);

    fireEvent.click(screen.getByRole("button", { name: "更新を確認" }));

    expect(
      await screen.findByText("新しいバージョンがあります"),
    ).toBeInTheDocument();
    expect(screen.getByText("現在 v0.1.0")).toBeInTheDocument();
    const versionLabels = screen.getAllByText("v0.2.0");
    expect(versionLabels).toHaveLength(2);
    expect(versionLabels[0]).toHaveClass("design-status-badge--info");
    expect(
      screen.getByRole("heading", { name: "リリースノート" }),
    ).toBeInTheDocument();
    expect(screen.getByText("操作性を改善しました。")).toBeInTheDocument();
  });

  it("downloads, installs, and relaunches while keeping progress visible", async () => {
    const { update, downloadAndInstall } = createUpdate();
    updaterMocks.check.mockResolvedValue(update);
    render(<UpdaterSettings />);

    fireEvent.click(screen.getByRole("button", { name: "更新を確認" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "ダウンロードして再起動" }),
    );

    await waitFor(() => expect(downloadAndInstall).toHaveBeenCalledOnce());
    await waitFor(() => expect(updaterMocks.relaunch).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent("再起動しています...");
    expect(
      screen.getByRole("button", { name: "再起動しています..." }),
    ).toBeDisabled();
  });

  it("shows a helpful retry message without exposing low-level errors", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    updaterMocks.check.mockRejectedValue(
      new Error("HTTP 500: internal detail"),
    );
    render(<UpdaterSettings />);

    fireEvent.click(screen.getByRole("button", { name: "更新を確認" }));

    expect(
      await screen.findByText(
        "更新情報を取得できませんでした。ネットワーク接続を確認して、もう一度お試しください。",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "更新情報を取得できませんでした。ネットワーク接続を確認して、もう一度お試しください。",
    );
    expect(screen.queryByText(/HTTP 500/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更新を確認" })).toBeEnabled();
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to check for updates",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });
});
