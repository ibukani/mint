import type { SettingsTabId } from "../navigation/settingsTabs";
import type { AppSettings } from "../settingsModel";
import type { ActionPorts } from "./ports";

export type { SettingsTabId };

export type ActionExecutionStatus =
  | "success"
  | "validationError"
  | "unavailable"
  | "cancelled"
  | "failed"
  | "partiallyCompleted";

export interface ActionSuccessResult<O> {
  status: "success";
  data: O;
}

export interface ActionValidationErrorResult {
  status: "validationError";
  message: string;
}

export interface ActionUnavailableResult {
  status: "unavailable";
  reason: string;
  disabledSettingsTarget?: { tabId: SettingsTabId; targetId?: string };
}

export interface ActionCancelledResult {
  status: "cancelled";
  reason?: string;
}

export interface ActionFailedResult {
  status: "failed";
  message: string;
  /** Optional cleanup information returned instead of pretending a partial
   *  failure is a success. */
  cleanup?: { description: string };
}

export interface ActionPartiallyCompletedResult<O> {
  status: "partiallyCompleted";
  data: O;
  /** What was already applied before the failure, so callers can offer
   *  undo or resume instead of treating the action as fully successful. */
  applied: string[];
  message?: string;
}

export type ActionExecutionResult<O> =
  | ActionSuccessResult<O>
  | ActionValidationErrorResult
  | ActionUnavailableResult
  | ActionCancelledResult
  | ActionFailedResult
  | ActionPartiallyCompletedResult<O>;

export type ActionAvailability =
  | { available: true }
  | {
      available: false;
      reason: string;
      disabledSettingsTarget?: { tabId: SettingsTabId; targetId?: string };
    };

export interface ActionContext {
  settings: AppSettings | null;
  ports: ActionPorts;
}

/** Runtime validator for an action input. Implementations must throw
 *  `ActionValidationError` for invalid values instead of returning them. */
export interface ActionInputSchema<I> {
  parse(input: unknown): I;
}

export interface CrossFeatureAction<I, O> {
  id: string;
  title: string;
  description: string;
  /** Feature folder id of the action source, e.g. "file_shelf". */
  sourceFeature: string;
  /** Feature folder id of the action destination, e.g. "quick_capture". */
  destinationFeature: string;
  inputSchema: ActionInputSchema<I>;
  availability: (context: ActionContext) => ActionAvailability;
  execute: (
    input: I,
    context: ActionContext,
  ) => Promise<ActionExecutionResult<O>>;
}

/**
 * Type-erased view of a cross-feature action used by the static registry.
 * Concrete `CrossFeatureAction<I, O>` instances are assignable to it, letting
 * the registry store heterogeneous actions without losing runtime behavior.
 */
export interface CrossFeatureActionRecord {
  id: string;
  title: string;
  description: string;
  sourceFeature: string;
  destinationFeature: string;
  inputSchema: ActionInputSchema<unknown>;
  availability: (context: ActionContext) => ActionAvailability;
  execute: (
    input: never,
    context: ActionContext,
  ) => Promise<ActionExecutionResult<unknown>>;
}
