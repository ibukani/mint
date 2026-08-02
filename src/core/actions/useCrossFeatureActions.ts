import { useCallback, useRef, useState } from "react";
import { useSettings } from "../context/AppSettings";
import { executeCrossFeatureAction } from "./execution";
import type { ActionPorts } from "./ports";
import type { ActionExecutionResult, SettingsTabId } from "./types";

export interface CrossFeatureFeedback {
  tone: "success" | "error" | "warning";
  message: string;
  settingsTarget?: { tabId: SettingsTabId; targetId?: string };
}

const mapResultToFeedback = (
  result: ActionExecutionResult<unknown>,
): CrossFeatureFeedback => {
  switch (result.status) {
    case "success":
      return { tone: "success", message: "完了しました。" };
    case "validationError":
      return { tone: "warning", message: result.message };
    case "unavailable":
      return {
        tone: "warning",
        message: result.reason,
        settingsTarget: result.disabledSettingsTarget,
      };
    case "cancelled":
      return {
        tone: "warning",
        message: result.reason ?? "キャンセルしました。",
      };
    case "partiallyCompleted":
      return {
        tone: "warning",
        message: result.message ?? "一部の処理が完了しました。",
      };
    case "failed":
      return { tone: "error", message: result.message };
  }
};

/**
 * Shared runner for cross-feature actions. Feature UIs compose their `ports`
 * once and reuse this hook instead of duplicating availability checks, input
 * validation, and error normalization. Guards against double execution while
 * an action is in flight.
 */
export const useCrossFeatureActions = (ports: ActionPorts) => {
  const settings = useSettings();
  const [runningActionId, setRunningActionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<CrossFeatureFeedback | null>(null);
  const inFlightRef = useRef(false);

  const runAction = useCallback(
    async (actionId: string, input: unknown) => {
      if (inFlightRef.current) return null;
      inFlightRef.current = true;
      setRunningActionId(actionId);
      setFeedback(null);
      try {
        const result = await executeCrossFeatureAction(actionId, input, {
          settings,
          ports,
        });
        setFeedback(mapResultToFeedback(result));
        return result;
      } finally {
        inFlightRef.current = false;
        setRunningActionId(null);
      }
    },
    [ports, settings],
  );

  const clearFeedback = useCallback(() => setFeedback(null), []);

  return {
    runAction,
    runningActionId,
    feedback,
    clearFeedback,
  };
};
