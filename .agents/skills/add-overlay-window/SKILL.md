---
name: add-overlay-window
description: Add and verify a Mint Tauri overlay window with static React routing, browser label mocking, design-layer framing, and shortcut lifecycle checks. Use when creating or changing an auxiliary window or overlay.
---

# Add an overlay window

1. Read `docs/design-architecture.md`, then inspect the owning feature and `src/core/windowRoutes.ts`.
2. Add the overlay component under `src/features/<feature>/components/`. Prefer `OverlayFrame` and `OverlayCard`; keep feature CSS inside the feature and use tokens.
3. Add the non-main window to `src-tauri/tauri.conf.json` with a unique label. Choose visibility, decorations, transparency, focus, and always-on-top behavior deliberately.
4. Register the same label statically in `WINDOW_ROUTES`. Do not add runtime discovery or dynamic registries.
5. Verify browser rendering with `?label=<label>`. Confirm opaque CSS does not defeat transparency.
6. If a shortcut opens the window, use `settings.active_shortcuts()` and confirm disabled/placeholder states do not register it.
7. Add route/component tests as appropriate; run `npm run check:quick` and `npm run check:all` when available.
8. Perform the relevant window, tray, shortcut, focus, and auto-hide checks from `docs/manual-verification.md` on the target platform.
