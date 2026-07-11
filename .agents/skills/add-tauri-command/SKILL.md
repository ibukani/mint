---
name: add-tauri-command
description: Add a typed Mint Tauri IPC command and synchronize Rust registration, TypeScript call sites, browser/Vitest mocks, errors, and tests. Use when adding or changing invoke-based backend behavior.
---

# Add a Tauri command

1. Inspect the owning feature, existing nearby commands, frontend invokes, and mocks.
2. Define one focused `#[tauri::command]` with concrete arguments and return types. Avoid `serde_json::Value`, catch-all dispatchers, and hidden global state.
3. Register it in `tauri::generate_handler!` in `src-tauri/src/lib.rs`.
4. Add the typed frontend call at the owning feature boundary. Keep async work outside React state-updater callbacks and guard stale async results where needed.
5. Implement the same command in browser and Vitest mock paths with realistic success, state change, and relevant failure behavior—not an always-successful stub.
6. Test serialization names, success, validation/error handling, and the mock-visible workflow.
7. Run `npm run check:quick`; then run `npm run check:tauri` and `npm run check:all` when available.
