import { setTimeout as sleep } from "node:timers/promises";

const JSON_HEADERS = { "Content-Type": "application/json" };

export class WebDriverClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.sessionId = null;
  }

  async request(method, path, body) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: body === undefined ? undefined : JSON_HEADERS,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // keep null; non-JSON responses are surfaced via the raw text
    }
    if (!response.ok) {
      throw new Error(
        `WebDriver ${method} ${path} failed with ${response.status}: ${text}`,
      );
    }
    return json ? json.value : undefined;
  }

  async createSession(applicationPath, options = {}) {
    const value = await this.request("POST", "/session", {
      capabilities: {
        alwaysMatch: {
          browserName: "wry",
          "tauri:options": { application: applicationPath, ...options },
        },
      },
    });
    this.sessionId = value.sessionId;
    return value;
  }

  async execute(script, args = []) {
    return this.request("POST", `/session/${this.sessionId}/execute/sync`, {
      script,
      args,
    });
  }

  async executeAsync(script, args = []) {
    return this.request("POST", `/session/${this.sessionId}/execute/async`, {
      script,
      args,
    });
  }

  async windowHandles() {
    return this.request("GET", `/session/${this.sessionId}/window/handles`);
  }

  async currentWindowHandle() {
    return this.request("GET", `/session/${this.sessionId}/window`);
  }

  async switchWindow(handle) {
    return this.request("POST", `/session/${this.sessionId}/window`, {
      handle,
    });
  }

  async screenshot() {
    return this.request("GET", `/session/${this.sessionId}/screenshot`);
  }

  async deleteSession() {
    if (!this.sessionId) return;
    const id = this.sessionId;
    this.sessionId = null;
    await this.request("DELETE", `/session/${id}`);
  }
}

export async function waitFor(
  probe,
  { timeoutMs = 20000, intervalMs = 250, description = "condition" } = {},
) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const result = await probe();
      if (result !== null && result !== undefined && result !== false) {
        return result;
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(intervalMs);
  }
  const suffix = lastError ? ` (last error: ${lastError.message})` : "";
  throw new Error(`Timed out waiting for ${description}${suffix}`);
}

export async function sleepMs(ms) {
  await sleep(ms);
}
