---
name: update-settings-schema
description: Step-by-step instructions for safely updating and expanding the AppSettings schema across TypeScript, Rust, and mock environments.
---

# `update-settings-schema` Skill

This skill explains how to safely update and extend the user settings schema (`AppSettings`) shared across the application without introducing frontend/backend inconsistencies.

## Purpose
- Add, update, or remove application-wide settings fields.
- Keep TypeScript types, Rust serialization/deserialization structs, and browser/test mocks fully synchronized.

---

## Likely Files to Touch
- **Frontend settings definitions**: [AppSettings.tsx](../../../src/core/context/AppSettings.tsx)
- **Backend settings definitions**: [settings.rs](../../../src-tauri/src/core/settings.rs)
- **Automatic mock defaults**: [tauriMock.ts](../../../src/core/mocks/tauriMock.ts) and [vitestSetup.ts](../../../src/core/mocks/vitestSetup.ts)
- **Feature-specific types**: `src/features/<feature_name>/types.ts`

---

## Required Architecture Rules
1. **Maintain three-way synchronization**: When adding a setting, update all three places at the same time: the **TypeScript interface**, the **Rust struct**, and the **mock default object**.
2. **Follow naming conventions**:
   - Frontend (TypeScript): `camelCase`, for example `voiceToText`
   - Backend (Rust): `snake_case`, for example `voice_to_text`
   - Confirm Rust-side struct attributes include `#[serde(rename_all = "camelCase")]` or equivalent serde renames so JSON serialization uses `camelCase`.
3. **Do not use `as any` casts**: Do not bypass type checks with `as any` in `updateSettings` calls just because updating types feels tedious.

---

## Procedure

### Step 1: Update Frontend Type Definitions
Add the setting field to the target feature's `types.ts` and update the `AppSettings` interface in [AppSettings.tsx](../../../src/core/context/AppSettings.tsx).

```typescript
// AppSettings.tsx
export interface AppSettings {
  theme: "dark" | "light";
  clock: ClockSettings;
  voiceToText: VoiceToTextSettings;
  myNewFeature: MyNewFeatureSettings; // Newly added field (camelCase)
}
```

### Step 2: Update Backend (Rust) Structs
Open [settings.rs](../../../src-tauri/src/core/settings.rs), add the field to the settings struct, and update the `Default` implementation.

```rust
// settings.rs
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct AppSettings {
    pub theme: String,
    pub clock: ClockSettings,
    #[serde(rename = "voiceToText")]
    pub voice_to_text: VoiceToTextSettings,
    #[serde(rename = "myNewFeature")]
    pub my_new_feature: MyNewFeatureSettings, // Newly added field (snake_case + serde rename)
}
```

### Step 3: Update Mock Defaults
Add the new field's default value to the `defaultSettings` constant in [tauriMock.ts](../../../src/core/mocks/tauriMock.ts) and [vitestSetup.ts](../../../src/core/mocks/vitestSetup.ts).

```typescript
export const defaultSettings: AppSettings = {
  theme: "dark",
  clock: { enabled: false, shortcut: "Ctrl+Alt+C" },
  voiceToText: { enabled: false, shortcut: "Ctrl+Alt+V" },
  myNewFeature: { enabled: false, shortcut: "Ctrl+Alt+N" }, // Newly added default value
};
```

### Step 4: Run Architecture Verification
Verify that the change is recognized correctly and has no inconsistencies.
```bash
npm run verify:architecture
```

---

## Definition of Done
- [ ] TypeScript, Rust, and mock settings definitions are consistent.
- [ ] `npm run verify:architecture` passes.
- [ ] `npm run test` and `npm run build` pass.
- [ ] Code using the new field contains no `as any` casts.

---

## Required Verification
- `npm run verify:architecture`
- `npm run test`
- `npm run build`

---

## Common Failures
- **Missing Rust `Default` implementation update**: A field is added to `AppSettings` in `settings.rs`, but the `Default` implementation or individual setting default is not updated, causing compilation errors.
- **Mock synchronization gap**: Frontend and Rust are aligned, but `tauriMock.ts` is not updated, so the settings object is incomplete at browser startup and the UI crashes.
- **`camelCase` and `snake_case` spelling mismatch**: Frontend and backend spelling or casing differs slightly, causing automatic verification errors.
