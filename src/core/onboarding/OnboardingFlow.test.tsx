import { invoke } from "@tauri-apps/api/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppSettingsProvider } from "../context/AppSettings";
import { createMockSettings } from "../mocks/mockSettings";
import { OnboardingFlow } from "./OnboardingFlow";

const eventMocks = vi.hoisted(() => ({
  listeners: new Map<string, () => void | Promise<void>>(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (event: string, handler: () => void | Promise<void>) => {
    eventMocks.listeners.set(event, handler);
    return () => eventMocks.listeners.delete(event);
  }),
}));

const mockSettings = createMockSettings({
  onboarding: { completedVersion: 0 },
});

const getSaveCalls = () =>
  vi
    .mocked(invoke)
    .mock.calls.filter(([command]) => command === "save_settings")
    .map(
      ([, args]) =>
        (args as { settings?: unknown }).settings as {
          onboarding: { completedVersion: number };
          quickCapture?: { enabled: boolean };
        } | null,
    );

beforeEach(() => {
  vi.clearAllMocks();
  eventMocks.listeners.clear();
  vi.mocked(invoke).mockImplementation(async (command: string) => {
    if (command === "load_settings") return mockSettings;
    if (command === "open_overlay") return undefined;
    return undefined;
  });
});

const renderFlow = () => {
  const onComplete = vi.fn();
  render(
    <AppSettingsProvider>
      <OnboardingFlow onComplete={onComplete} />
    </AppSettingsProvider>,
  );
  return { onComplete };
};

const walkToFinalStep = async () => {
  await screen.findByRole("heading", { name: "使う機能を選ぶ" });
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));
  await screen.findByRole("heading", { name: "呼び出し操作を確認" });
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));
  await screen.findByRole("heading", { name: "外観と常駐設定" });
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));
  await screen.findByRole("heading", { name: "最初の操作を試す" });
};

describe("OnboardingFlow", () => {
  it("shows feature selection as the first step", async () => {
    renderFlow();

    await screen.findByRole("heading", { name: "使う機能を選ぶ" });
    expect(screen.getByText("ステップ 1 / 4")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "クイックキャプチャーを使う" }),
    ).toBeChecked();
    expect(
      screen.getByRole("button", { name: "後で設定する" }),
    ).toBeInTheDocument();
  });

  it("records shortcut conflicts and blocks proceeding", async () => {
    renderFlow();

    await screen.findByRole("heading", { name: "使う機能を選ぶ" });
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    await screen.findByRole("heading", { name: "呼び出し操作を確認" });

    // 時計のショートカットをファイルシェル（Alt+3）と衝突させる
    const clockInput = screen.getByLabelText("時計を開く");
    fireEvent.focus(clockInput);
    fireEvent.keyDown(clockInput, { key: "3", altKey: true });

    await waitFor(() => {
      expect(clockInput).toHaveValue("Alt+3");
    });

    expect(screen.getByRole("button", { name: "次へ" })).toBeDisabled();
    expect(
      screen
        .getAllByRole("alert")
        .some(
          (node) =>
            node.textContent?.includes("ショートカットキーが重複しています") ??
            false,
        ),
    ).toBe(true);
  });

  it("commits settings and marks onboarding complete", async () => {
    const { onComplete } = renderFlow();

    await screen.findByRole("heading", { name: "使う機能を選ぶ" });
    fireEvent.click(
      screen.getByRole("checkbox", { name: "クイックキャプチャーを使う" }),
    );
    await walkToFinalStep();

    fireEvent.click(screen.getByRole("button", { name: "完了" }));

    await waitFor(
      () => {
        const saves = getSaveCalls();
        expect(saves.some((s) => s?.onboarding.completedVersion === 1)).toBe(
          true,
        );
      },
      { timeout: 3000 },
    );
    expect(onComplete).toHaveBeenCalled();
  });

  it("applies the disabled feature choice to the committed settings", async () => {
    renderFlow();

    await screen.findByRole("heading", { name: "使う機能を選ぶ" });
    fireEvent.click(
      screen.getByRole("checkbox", { name: "クイックキャプチャーを使う" }),
    );
    await walkToFinalStep();
    fireEvent.click(screen.getByRole("button", { name: "完了" }));

    await waitFor(
      () => {
        const saves = getSaveCalls();
        expect(
          saves.some(
            (s) =>
              s?.onboarding.completedVersion === 1 &&
              s?.quickCapture?.enabled === false,
          ),
        ).toBe(true);
      },
      { timeout: 3000 },
    );
  });

  it("skips setup by marking complete without changing settings", async () => {
    const { onComplete } = renderFlow();

    await screen.findByRole("heading", { name: "使う機能を選ぶ" });
    fireEvent.click(screen.getByRole("button", { name: "後で設定する" }));

    await waitFor(
      () => {
        const saves = getSaveCalls();
        expect(saves.some((s) => s?.onboarding.completedVersion === 1)).toBe(
          true,
        );
      },
      { timeout: 3000 },
    );
    expect(onComplete).toHaveBeenCalled();
  });

  it("shows the recommended first action from enabled features", async () => {
    renderFlow();

    await walkToFinalStep();

    expect(
      screen.getByText("ショートカットで最初のメモを書く"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "試す" })).toBeInTheDocument();
  });
});
