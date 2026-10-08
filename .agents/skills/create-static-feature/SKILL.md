---
name: create-static-feature
description: Scaffold and implement a new Mint feature module. Use when adding a new module under src/features.
---

# Create a static feature

1. Run `npm run ai:context` if the integration points are not already known. Use [architecture](../../../docs/architecture.md) for module boundaries.
2. Run `npm run scaffold:feature <snake_case_name> [PascalComponentName]`; inspect the generated frontend/Rust modules, settings/default/mock entries, and settings-tab registration. Do not recreate that initial wiring manually.
3. Implement the requested behavior in the owning feature. Compose shared UI from `src/design`; preserve disabled/placeholder guards until the feature is usable.
4. For additional integration, consult only the relevant workflow: [IPC](../add-tauri-command/SKILL.md), [window](../add-overlay-window/SKILL.md), or [settings schema](../update-settings-schema/SKILL.md). Use [design ownership](../../../docs/design-architecture.md) when changing UI.
5. Verify the generated diff and important feature behavior using the [verification scope](../../../docs/ai-development.md#検証範囲). Run scaffold smoke tests when the scaffolder or its verification changes; do not repeat checks included in a parent gate.

The generated shell alone is not a completed feature. UI/desktop changes require [actual desktop evidence](../../../docs/manual-verification.md#ui変更時の必須確認); report unverified behavior and remaining risks.
