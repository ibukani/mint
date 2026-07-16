import type { MockIPCArgs, MockIPCResult } from "./ipcMockTypes";
import { handled, unhandled } from "./ipcMockTypes";

export interface ApiKeyIpcMockOptions {
  load?: (service: string | undefined) => string | Promise<string>;
  save?: (
    service: string | undefined,
    key: string | undefined,
  ) => unknown | Promise<unknown>;
  defaultKey: string;
}

export async function handleApiKeyIpcCommand(
  command: string,
  args: MockIPCArgs,
  options: ApiKeyIpcMockOptions,
): Promise<MockIPCResult> {
  switch (command) {
    case "load_api_key": {
      const service = args?.service as string | undefined;
      return handled(await (options.load?.(service) ?? options.defaultKey));
    }
    case "save_api_key": {
      const service = args?.service as string | undefined;
      const key = args?.key as string | undefined;
      return handled(await options.save?.(service, key));
    }
    default:
      return unhandled();
  }
}
