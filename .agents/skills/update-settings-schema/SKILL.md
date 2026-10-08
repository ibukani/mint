---
name: update-settings-schema
description: Change the serialized Mint AppSettings schema, defaults, or migrations while preserving existing data compatibility.
---

# Update the settings schema

1. Locate the feature types, `src/core/settingsModel.ts`, `defaultSettings.ts`, `mocks/mockSettings.ts`, and Rust `core/settings_model.rs`. `settings.rs` is the command facade; `settings_store.rs` owns persistence.
2. Define the serialized JSON contract: camelCase JSON/TypeScript and snake_case Rust with serde mapping. Update types/defaults and mock factory together; do not suppress drift with unsafe casts.
3. For persisted compatibility changes, use [migrations](../../../docs/migrations.md) and the existing `core/migrations/settings` chain. Preserve old/partial input, versioned envelopes, backup-before-write, and future-version protection. Use serde aliases/defaults when sufficient; a type rename alone does not migrate data.
4. Preserve the onboarding distinction: fresh installs start incomplete, existing-user migration and browser mocks simulate completed setup. Update affected UI, shortcut guards, and command consumers; reuse the settings store's save/conflict control.
5. Test the changed defaults, serialized round trip, old/partial inputs, migration, and mock workflow as applicable. Use the [verification scope](../../../docs/ai-development.md#検証範囲) and report unavailable checks.

Initial feature wiring is supplied by the scaffolder; this workflow applies to schema/default/compatibility changes beyond that generated wiring.
