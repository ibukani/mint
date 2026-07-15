export type MockIPCArgs = Record<string, unknown> | undefined;

export type MockIPCResult =
  | { handled: true; value: unknown }
  | { handled: false };

export const handled = (value: unknown): MockIPCResult => ({
  handled: true,
  value,
});

export const unhandled = (): MockIPCResult => ({ handled: false });
