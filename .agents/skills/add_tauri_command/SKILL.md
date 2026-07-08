---
name: add-tauri-command
description: Safe, type-safe guide to adding a new Tauri backend command and registering it correctly in both Rust and TypeScript sides, including mocks.
---

# `add-tauri-command` Skill

This skill explains how to add a new Tauri command (IPC command) to the Mint application and wire safe, type-safe communication between the frontend and backend.

## Purpose
- Define behavior executed in the Rust backend and make it callable from the frontend.
- Avoid dynamic dispatch and generic payloads such as `serde_json::Value`; use strict static typing for communication.

---

## Likely Files to Touch
- **Backend implementation**: [src-tauri/src/features/<feature_name>.rs](../../../src-tauri/src/features/) (example)
- **Tauri command registration**: [src-tauri/src/lib.rs](../../../src-tauri/src/lib.rs)
- **Automatic mock definitions**: [src/core/mocks/tauriMock.ts](../../../src/core/mocks/tauriMock.ts)
- **Frontend call sites**: `src/features/<feature_name>/hooks/` or `components/`

---

## Required Architecture Rules
1. **Use static command definitions**: Every Tauri command must be statically defined on the Rust side as an individual function with its own `#[tauri::command]` annotation.
2. **Do not use `serde_json::Value`**: Arguments and return values must not use generic types such as `serde_json::Value`. Use concrete Rust structs that implement `Serialize`/`Deserialize`, or primitive data types.
3. **Mocks are required**: Add a same-named mock command in `tauriMock.ts` so the frontend can be tested in the browser. Empty implementations that only return `Promise.resolve()` are forbidden.

---

## Procedure

### Step 1: Define the Command Function in the Rust Backend
Add the command handler function to the target feature module file, for example `src-tauri/src/features/clock.rs`.

```rust
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct MyCommandResponse {
    pub success: bool,
    pub message: String,
}

#[tauri::command]
pub fn my_feature_command(payload: String) -> Result<MyCommandResponse, String> {
    // Implement the real business logic.
    if payload.is_empty() {
        return Err("Payload cannot be empty".to_string());
    }
    
    Ok(MyCommandResponse {
        success: true,
        message: format!("Received: {}", payload),
    })
}
```

### Step 2: Register the Command in `src-tauri/src/lib.rs`
Add the defined command to `tauri::generate_handler!`.

```rust
        .invoke_handler(tauri::generate_handler![
            core::settings::load_settings,
            core::settings::save_settings,
            core::settings::load_api_key,
            core::settings::save_api_key,
            features::clock::clock_command, // Existing command
            features::my_feature::my_feature_command, // Newly added command
        ])
```

### Step 3: Wire the Frontend Mock Environment
Open [tauriMock.ts](../../../src/core/mocks/tauriMock.ts) and add the new command to the `mockInvoke` branch.
Implement simulation logic that returns dummy values or changes state such as `localStorage` so the behavior can be verified in the browser.

```typescript
// Invoke map inside tauriMock.ts
const mockInvokes: Record<string, (args: unknown) => unknown> = {
  // ...
  "my_feature_command": (args: { payload: string }) => {
    if (!args.payload) {
      throw new Error("Payload cannot be empty");
    }
    return {
      success: true,
      message: `[MOCK] Received: ${args.payload}`
    };
  }
};
```

### Step 4: Call the Command from the Frontend
Call the command with `invoke` from `@tauri-apps/api/core`, or follow the repository's existing wrapper/import pattern if one exists.

```typescript
import { invoke } from "@tauri-apps/api/core";

const callMyCommand = async (text: string) => {
  try {
    const response = await invoke<{ success: boolean; message: string }>("my_feature_command", {
      payload: text
    });
    console.log(response.message);
  } catch (error) {
    console.error("Command failed:", error);
  }
};
```

---

## Definition of Done
- [ ] The Rust command is registered in `lib.rs` and compiles.
- [ ] The same-named command is registered in the frontend mock, the browser does not crash on startup, and mock behavior can be verified.
- [ ] Command argument and return-value types are synchronized between TypeScript and Rust.
- [ ] `npm run verify:architecture` reports no errors.
- [ ] `npm run test` passes.

---

## Required Verification
1. **Rust compilation verification**: Run `cargo check` or `cargo test`.
2. **Architecture verification**: `npm run verify:architecture`
3. **Behavior verification**: Confirm with frontend unit tests or browser mocks that the expected dummy data is returned.

---

## Common Failures
- **Argument name mismatch**: Rust defines an argument in `snake_case` (for example `user_id`) while TypeScript passes it in `camelCase` (for example `userId`), causing a serialization error.
- **Missing mock registration**: A new command is added only in Rust and omitted from `tauriMock.ts`, causing "Unsupported mock command" errors in browser development or Vitest.
- **Misuse of `serde_json::Value`**: Using `payload: serde_json::Value` because defining argument types feels tedious, which bypasses compile-time checks.
