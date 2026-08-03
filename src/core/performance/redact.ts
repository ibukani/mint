// Redacts personal information before diagnostics text leaves the machine.
// The native diagnostics report is already structured without sensitive
// fields; this is a defensive second layer for free-form text and for any
// future report fields that embed user data.

const API_KEY_PATTERN = /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{8,}\b/g;

const SECRET_ASSIGNMENT_PATTERN =
  /\b(api[_-]?key|token|secret)\s*[:=]\s*["']?[^\s"',;]{8,}["']?/gi;

const ABSOLUTE_PATH_PATTERN =
  /(?:[A-Za-z]:[\\/]|\/(?:home|Users|users)\/)[^\s"',;]+/g;

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export const redactSensitiveText = (text: string): string => {
  let redacted = text.replace(
    API_KEY_PATTERN,
    (match) => `${match.slice(0, 4)}***`,
  );
  redacted = redacted.replace(SECRET_ASSIGNMENT_PATTERN, (match) => {
    const operatorIndex = match.search(/[=:]/);
    const keyName = match.slice(0, operatorIndex + 1).trimEnd();
    return `${keyName} ***`;
  });
  redacted = redacted.replace(ABSOLUTE_PATH_PATTERN, (match) => {
    const separator = match.includes("\\") ? "\\" : "/";
    const parts = match.split(separator);
    return `[パス]${separator}${parts[parts.length - 1]}`;
  });
  redacted = redacted.replace(EMAIL_PATTERN, "[メールアドレス]");
  return redacted;
};

/** Replaces every value of a record that matches a sensitive shape. */
export const redactRecord = (
  record: Readonly<Record<string, string>>,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      redactSensitiveText(value),
    ]),
  );
