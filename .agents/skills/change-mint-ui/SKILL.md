---
name: change-mint-ui
description: Change Mint React UI structure, styling, or interaction, following design ownership and desktop visual verification.
---

# Change Mint UI

1. Use [design architecture](../../../docs/design-architecture.md) and inspect the owning component/CSS and existing shared controls before adding primitives.
2. Put reusable tokens, controls, and app/overlay framing in `src/design`; keep feature composition/CSS under its feature and core UI CSS beside its core owner. Compose existing settings/form/overlay components where applicable.
3. Use tokens for shared visual values. Preserve documented runtime CSS-variable, canvas/coordinate, and migration exceptions; keep feature-specific visualization values with their owner. Do not restore legacy global classes or override-only CSS files.
4. Preserve labels, help/error association, keyboard focus, reduced-motion behavior, desktop narrow layouts, and light/dark themes.
5. Add interaction tests when behavior or semantics change. For visual-only changes, use visual evidence and the [applicable checks](../../../docs/ai-development.md#検証範囲).
6. Verify the affected browser route (`?label=<label>` for overlays) as useful supplemental coverage, then complete [Tauri desktop and screenshot verification](../../../docs/manual-verification.md#ui変更時の必須確認). Fix affected visual/interaction defects and repeat the relevant check; report sizes, themes, images, and remaining risks.
