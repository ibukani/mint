import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useAutoClearStatus } from "./useAutoClearStatus";

const TestComponent = () => {
  const [status, setStatus] = useState("");
  const [paused, setPaused] = useState(false);

  useAutoClearStatus(
    status,
    () => setStatus(""),
    (currentStatus) => (currentStatus === "error" ? 5000 : 2000),
    paused,
  );

  return (
    <div>
      <div data-testid="status">{status || "empty"}</div>
      <button type="button" onClick={() => setStatus("ok")}>
        OK
      </button>
      <button type="button" onClick={() => setStatus("error")}>
        Error
      </button>
      <button type="button" onClick={() => setPaused((current) => !current)}>
        Toggle Pause
      </button>
    </div>
  );
};

describe("useAutoClearStatus", () => {
  it("clears a normal status after the configured delay", async () => {
    vi.useFakeTimers();
    try {
      render(<TestComponent />);

      fireEvent.click(screen.getByRole("button", { name: "OK" }));
      expect(screen.getByTestId("status")).toHaveTextContent("ok");

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.getByTestId("status")).toHaveTextContent("empty");
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses a longer delay for error statuses", async () => {
    vi.useFakeTimers();
    try {
      render(<TestComponent />);

      fireEvent.click(screen.getByRole("button", { name: "Error" }));
      expect(screen.getByTestId("status")).toHaveTextContent("error");

      await act(async () => {
        vi.advanceTimersByTime(4999);
      });

      expect(screen.getByTestId("status")).toHaveTextContent("error");

      await act(async () => {
        vi.advanceTimersByTime(1);
      });

      expect(screen.getByTestId("status")).toHaveTextContent("empty");
    } finally {
      vi.useRealTimers();
    }
  });

  it("pauses the timer while paused", async () => {
    vi.useFakeTimers();
    try {
      render(<TestComponent />);

      fireEvent.click(screen.getByRole("button", { name: "OK" }));
      fireEvent.click(screen.getByRole("button", { name: "Toggle Pause" }));

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.getByTestId("status")).toHaveTextContent("ok");

      fireEvent.click(screen.getByRole("button", { name: "Toggle Pause" }));

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.getByTestId("status")).toHaveTextContent("empty");
    } finally {
      vi.useRealTimers();
    }
  });
});
