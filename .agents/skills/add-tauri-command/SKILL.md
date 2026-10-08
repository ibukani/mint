---
name: add-tauri-command
description: Add or change a Mint Tauri IPC command contract, including Rust registration, TypeScript calls, and shared mocks.
---

# Add or change a Tauri command

1. Inspect the owning feature/core boundary, nearby commands, callers, and shared `*IpcMock.ts` handlers.
2. Use concrete argument/return types and register new commands in `src-tauri/src/lib.rs` with `tauri::generate_handler!`. Do not introduce a catch-all JSON IPC dispatcher; JSON parsing in persistence/migrations is a separate concern.
3. Keep state ownership explicit, async work outside React updater callbacks, and stale results from overwriting newer state. Reuse existing settings persistence and window helpers.
4. For high-impact commands, apply the caller-window boundary and minimum permissions in [security capabilities](../../../docs/security-capabilities.md).
5. Update typed frontend calls and the shared browser/Vitest mock contract, including state changes and relevant failure behavior. Inject environment differences at the mock entrypoints instead of duplicating handlers.
6. Verify changed serialization names, validation/errors, and the mock-visible workflow with the [applicable checks](../../../docs/ai-development.md#検証範囲). Run a containing gate once; report unavailable checks.
