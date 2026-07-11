---
name: create-static-feature
description: Scaffold and implement a new Mint feature module with synchronized TypeScript, Rust, settings defaults, mocks, and settings navigation. Use when adding a new tool or feature under src/features and src-tauri/src/features.
---

# Create a static feature

1. Read `docs/ai-development.md` and run `npm run ai:context`.
2. Run `npm run scaffold:feature <snake_case_name> [PascalName]`. Never recreate its initial wiring manually.
3. Inspect the generated diff. The scaffolder creates frontend types/settings UI, a Rust module, AppSettings/default/mock entries, and settings-tab registration.
4. Replace generated placeholder behavior with the requested implementation. Keep feature logic under its feature folder; use `src/design/components` for shared UI.
5. If backend IPC is needed, use `$add-tauri-command`. If an overlay is needed, use `$add-overlay-window`. If the settings shape changes beyond the scaffold, use `$update-settings-schema`.
6. Add meaningful tests near the implementation. Placeholder features must remain disabled and must not register shortcuts or other OS side effects.
7. Run `npm run check:quick`, `npm run test:scaffold`, and, before handoff, `npm run check:all` when available.

Do not report the generated shell as a completed feature. Verify the requested behavior and record any manual desktop checks still required.
