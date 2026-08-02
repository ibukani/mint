/**
 * Thrown by `ActionInputSchema.parse` when input fails runtime validation.
 * The execution orchestrator converts this into a `validationError` result so
 * callers never have to inspect error strings.
 */
export class ActionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionValidationError";
  }
}
