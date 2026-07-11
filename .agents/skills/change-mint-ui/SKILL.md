---
name: change-mint-ui
description: Implement or refactor Mint React UI and CSS within the design-layer ownership rules, shared components, accessibility patterns, responsive behavior, and visual verification workflow. Use for settings screens, overlays, layout, styling, or reusable design components.
---

# Change Mint UI

1. Read `docs/design-architecture.md` and inspect the owning component, its CSS, and existing `src/design/components` before adding primitives.
2. Put reusable tokens, controls, and app/overlay framing in `src/design`; keep feature-specific composition and CSS in the feature; keep core UI CSS beside its core owner.
3. Compose `SettingsSection`, `Field`, `TextInput`, `Select`, `Button`, `OverlayFrame`, and `OverlayCard` where applicable. Do not revive legacy global classes.
4. Use design tokens for shared colors, spacing, radii, shadows, blur, typography, and transitions. Avoid inline visual styles and hard-coded colors; allow runtime CSS variables only for genuinely dynamic user data.
5. Preserve semantic labels, keyboard focus, error/help association, reduced-motion behavior, narrow layouts, and light/dark themes.
6. Add component/interaction tests. Run `npm run check:quick` and the relevant Vitest tests.
7. Verify the affected route in the browser (overlay routes use `?label=<label>`), at narrow and normal widths and both themes. For desktop behavior, follow `docs/manual-verification.md`.
