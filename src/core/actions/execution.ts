import { ActionValidationError } from "./errors";
import { getCrossFeatureAction } from "./registry";
import type {
  ActionAvailability,
  ActionContext,
  ActionExecutionResult,
} from "./types";

/**
 * Checks an action's availability without executing it. Returns
 * `{ available: false }` with a reason and settings shortcut for disabled
 * features, so UIs can surface the reason before running.
 */
export const getActionAvailability = (
  actionId: string,
  context: ActionContext,
): ActionAvailability => {
  const action = getCrossFeatureAction(actionId);
  if (!action) {
    return { available: false, reason: "利用できない操作です。" };
  }
  return action.availability(context);
};

/**
 * Executes a registered cross-feature action by id.
 *
 * Flow:
 *  1. look up the action in the static registry
 *  2. check availability (disabled features are reported as unavailable)
 *  3. runtime-validate the input through `inputSchema`
 *  4. execute the action through the typed ports
 *
 * Thrown errors are normalized into `failed` results so callers never rely on
 * error strings to decide state.
 */
export async function executeCrossFeatureAction(
  actionId: string,
  input: unknown,
  context: ActionContext,
): Promise<ActionExecutionResult<unknown>> {
  const action = getCrossFeatureAction(actionId);
  if (!action) {
    return { status: "failed", message: "利用できない操作です。" };
  }

  const availability = action.availability(context);
  if (!availability.available) {
    return {
      status: "unavailable",
      reason: availability.reason,
      disabledSettingsTarget: availability.disabledSettingsTarget,
    };
  }

  let parsed: unknown;
  try {
    parsed = action.inputSchema.parse(input);
  } catch (error) {
    if (error instanceof ActionValidationError) {
      return { status: "validationError", message: error.message };
    }
    return {
      status: "failed",
      message:
        error instanceof Error ? error.message : "入力が正しくありません。",
    };
  }

  try {
    return await action.execute(
      parsed as Parameters<typeof action.execute>[0],
      context,
    );
  } catch (error) {
    return {
      status: "failed",
      message:
        error instanceof Error
          ? error.message
          : "アクションを実行できませんでした。",
    };
  }
}
