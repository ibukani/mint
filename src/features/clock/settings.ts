export const CLOCK_AUTO_HIDE_MIN_SECONDS = 0;
export const CLOCK_AUTO_HIDE_MAX_SECONDS = 60;

export function normalizeAutoHideSeconds(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return CLOCK_AUTO_HIDE_MIN_SECONDS;
  }
  return Math.min(
    CLOCK_AUTO_HIDE_MAX_SECONDS,
    Math.max(CLOCK_AUTO_HIDE_MIN_SECONDS, parsed),
  );
}
