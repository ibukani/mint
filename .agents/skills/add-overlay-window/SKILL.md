---
name: add-overlay-window
description: Add a Mint auxiliary window or change its routing, permissions, opening behavior, or native lifecycle.
---

# Integrate an auxiliary window

1. Inspect the owning feature, existing window lifecycle, and static `WINDOW_ROUTES`. Use [design ownership](../../../docs/design-architecture.md) when adding/changing UI; prefer `OverlayFrame` / `OverlayCard` where applicable.
2. Add/update the unique label in `src-tauri/tauri.conf.json` and `src/core/windowRoutes.ts`. Choose size, focus, visibility, transparency, decorations, and always-on-top behavior for the requested workflow. Existing overlays use `create: false` for lazy creation.
3. Configure per-window minimum permissions using [security capabilities](../../../docs/security-capabilities.md); do not copy unrelated permissions. Keep mock window registration and `?label=<label>` rendering consistent.
4. For generic overlay opening, synchronize TypeScript `OverlayTarget` in `windowCommands.ts` with Rust `core/window.rs` and the owning show/toggle path. Specialized windows such as the calendar editor use their typed opening contract.
5. Integrate lazy creation and first-show `overlay_ready` handling with `useOverlayWindowReady`. For evictable windows, reuse the eviction lifecycle and confirm reopening recreates the window. Inspect `core/window_state` when position/size persistence is needed; resident windows may have different policies.
6. If shortcuts open the window, guard disabled/placeholder states through `settings.active_shortcuts()`. Verify relevant routing/lifecycle tests and [checks](../../../docs/ai-development.md#検証範囲).
7. Perform [actual desktop and screenshot checks](../../../docs/manual-verification.md#ui変更時の必須確認) for the changed opening, closing, focus, transparency, auto-hide, tray, and recreation behavior. Browser rendering is supplemental evidence.
