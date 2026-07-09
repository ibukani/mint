import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTimeoutTask } from "./useTimeoutTask";

describe("useTimeoutTask", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs the latest scheduled task and clears the previous one", () => {
    vi.useFakeTimers();

    const firstTask = vi.fn();
    const secondTask = vi.fn();
    const { result } = renderHook(() => useTimeoutTask());

    act(() => {
      result.current.scheduleTimeoutTask(firstTask, 1000);
      result.current.scheduleTimeoutTask(secondTask, 1000);
      vi.advanceTimersByTime(1000);
    });

    expect(firstTask).not.toHaveBeenCalled();
    expect(secondTask).toHaveBeenCalledTimes(1);
  });

  it("cancels a scheduled task when cleared", () => {
    vi.useFakeTimers();

    const task = vi.fn();
    const { result } = renderHook(() => useTimeoutTask());

    act(() => {
      result.current.scheduleTimeoutTask(task, 1000);
      result.current.clearTimeoutTask();
      vi.advanceTimersByTime(1000);
    });

    expect(task).not.toHaveBeenCalled();
  });
});
