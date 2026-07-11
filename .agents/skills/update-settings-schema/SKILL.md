---
name: update-settings-schema
description: Safely add, rename, migrate, or remove Mint AppSettings fields across TypeScript, Rust serde/defaults, persisted data compatibility, browser mocks, and tests. Use for any settings schema change outside initial feature scaffolding.
---

# Update the settings schema

1. Run `npm run ai:context` and locate the feature type, `settingsModel.ts`, `defaultSettings.ts`, Rust `settings.rs`, `mockSettings.ts`, and consumers.
2. Define the desired serialized JSON shape first. Use camelCase JSON, camelCase TypeScript, and snake_case Rust with serde mapping.
3. Update TypeScript types/defaults, Rust structs/defaults, and the shared mock factory together. Do not use `any` or casts to suppress drift.
4. Preserve old persisted settings when renaming or changing meaning: add serde aliases/defaults or an explicit migration and test old input. A type-compatible rename alone is not a migration.
5. Update settings UI, active-shortcut logic, and command behavior that depends on the field.
6. Test defaults, round trips/migration, partial persisted input, and browser mock behavior.
7. Run `npm run check:quick` and `npm run check:all` when available.
