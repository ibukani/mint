import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppSettingsProvider } from "../../../core/context/AppSettings";
import type {
  GoogleCalendarConnection,
  GoogleCalendarSyncResult,
} from "../types";
import { GoogleCalendarSettings } from "./GoogleCalendarSettings";

const mocks = vi.hoisted(() => ({
  getConnection: vi.fn(),
  connect: vi.fn(),
  listCalendars: vi.fn(),
  sync: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("../googleCalendar", () => ({
  getGoogleCalendarConnection: mocks.getConnection,
  connectGoogleCalendar: mocks.connect,
  listGoogleCalendars: mocks.listCalendars,
  syncGoogleCalendars: mocks.sync,
  disconnectGoogleCalendar: mocks.disconnect,
}));

const disconnected: GoogleCalendarConnection = {
  connected: false,
  accountEmail: "",
  lastSyncedAt: null,
  pendingOperations: 0,
  error: null,
  syncing: false,
};

const connected: GoogleCalendarConnection = {
  connected: true,
  accountEmail: "mint@example.com",
  lastSyncedAt: "2026-07-14T01:00:00.000Z",
  pendingOperations: 2,
  error: null,
  syncing: false,
};

const renderSettings = () =>
  render(
    <AppSettingsProvider>
      <GoogleCalendarSettings />
    </AppSettingsProvider>,
  );

describe("GoogleCalendarSettings", () => {
  beforeEach(() => {
    mocks.getConnection.mockReset().mockResolvedValue(disconnected);
    mocks.connect.mockReset().mockResolvedValue(connected);
    mocks.listCalendars.mockReset().mockResolvedValue([
      {
        id: "primary",
        name: "メイン",
        primary: true,
        accessRole: "owner",
        backgroundColor: "#4285f4",
      },
      {
        id: "team",
        name: "チーム",
        primary: false,
        accessRole: "reader",
        backgroundColor: "#33b679",
      },
    ]);
    mocks.sync.mockReset().mockResolvedValue({
      syncedCalendars: 0,
      changedEvents: 0,
      pendingOperations: 0,
      syncedAt: "2026-07-14T02:00:00.000Z",
    });
    mocks.disconnect.mockReset().mockResolvedValue(undefined);
  });

  it("keeps onboarding hidden until the stored connection is known", async () => {
    let resolveConnection: (value: GoogleCalendarConnection) => void = () =>
      undefined;
    mocks.getConnection.mockImplementationOnce(
      () =>
        new Promise<GoogleCalendarConnection>((resolve) => {
          resolveConnection = resolve;
        }),
    );

    renderSettings();

    expect(
      await screen.findByText("Google Calendarの接続状態を確認中"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Googleアカウントを接続" }),
    ).not.toBeInTheDocument();

    await act(async () => resolveConnection(disconnected));

    expect(
      await screen.findByRole("button", { name: "Googleアカウントを接続" }),
    ).toBeEnabled();
  });

  it("explains pending work and reports manual sync progress", async () => {
    let resolveSync: (value: GoogleCalendarSyncResult) => void = () =>
      undefined;
    mocks.getConnection.mockResolvedValue(connected);
    mocks.sync.mockImplementationOnce(
      () =>
        new Promise<GoogleCalendarSyncResult>((resolve) => {
          resolveSync = resolve;
        }),
    );

    renderSettings();

    expect(
      await screen.findByText("未同期の変更が2件あります"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "接続を解除" })).toBeDisabled();
    expect(screen.getByText("mint@example.com")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "今すぐ同期" }));

    expect(
      await screen.findByRole("button", { name: "同期しています…" }),
    ).toBeDisabled();
    expect(
      screen.getByText("Google Calendarと同期しています…"),
    ).toBeInTheDocument();

    mocks.getConnection.mockResolvedValue({
      ...connected,
      lastSyncedAt: "2026-07-14T02:00:00.000Z",
      pendingOperations: 0,
    });
    await act(async () =>
      resolveSync({
        syncedCalendars: 2,
        changedEvents: 3,
        pendingOperations: 0,
        syncedAt: "2026-07-14T02:00:00.000Z",
      }),
    );

    expect(await screen.findByText("3件の予定を更新しました。")).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "接続を解除" })).toBeEnabled(),
    );
  });

  it("does not start a competing calendar-list request during background sync", async () => {
    mocks.getConnection.mockResolvedValue({
      ...connected,
      pendingOperations: 0,
      syncing: true,
    });

    const view = renderSettings();

    expect(
      await screen.findByText("別の画面で開始した同期を完了しています…"),
    ).toBeInTheDocument();
    expect(screen.getByText("予定表を読み込んでいます…")).toBeInTheDocument();
    expect(mocks.listCalendars).not.toHaveBeenCalled();

    view.unmount();
  });

  it("turns technical load failures into a recoverable state", async () => {
    mocks.getConnection
      .mockRejectedValueOnce(
        new Error("Error: error sending request for url (network error)"),
      )
      .mockResolvedValueOnce(disconnected);

    renderSettings();

    expect(
      await screen.findByText("接続状態を確認できませんでした"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Google Calendarに接続できませんでした。通信環境を確認して、もう一度お試しください。",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "再確認" }));

    expect(
      await screen.findByRole("button", { name: "Googleアカウントを接続" }),
    ).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
