import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTransientStatus } from "./useTransientStatus";

describe("useTransientStatus", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("clears a status after the configured duration", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTransientStatus(1200));

    act(() => result.current[1]("保存しました"));
    expect(result.current[0]).toBe("保存しました");

    act(() => vi.advanceTimersByTime(1200));
    expect(result.current[0]).toBe("");
  });

  it("supports status-specific durations", () => {
    vi.useFakeTimers();
    const duration = vi.fn((status: string) =>
      status === "成功" ? 500 : 2000,
    );
    const { result } = renderHook(() => useTransientStatus(duration));

    act(() => result.current[1]("成功"));
    expect(duration).toHaveBeenCalledWith("成功");
    act(() => vi.advanceTimersByTime(500));
    expect(result.current[0]).toBe("");
  });

  it("keeps an explicit tone with the transient message", () => {
    const { result } = renderHook(() => useTransientStatus(1200));

    act(() => result.current[1]("入力を確認してください", "warning"));

    expect(result.current[0]).toBe("入力を確認してください");
    expect(result.current[2]).toBe("warning");
  });
});
