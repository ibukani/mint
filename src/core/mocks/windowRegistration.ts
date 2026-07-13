const MOCK_WINDOW_LABELS = [
  "main",
  "clock",
  "calendar",
  "gameLauncher",
  "calendarEditor",
  "quickCapture",
] as const;

export const getMockWindowRegistration = (currentLabel: string) => [
  currentLabel,
  ...MOCK_WINDOW_LABELS.filter((label) => label !== currentLabel),
];
