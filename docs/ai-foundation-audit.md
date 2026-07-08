# AI Development Foundation Audit

This document records the current evaluation of Mint's AI-first development foundation.

## Status

The project is in a good state for AI-assisted iteration:

- Static feature-module architecture is documented and enforced.
- Frontend, backend, mock, settings, window, and IPC wiring are checked by `npm run verify:architecture`.
- Fast orientation is available through `npm run ai:context`.
- Fast local feedback is available through `npm run check:quick`.
- Full frontend and backend gates are available through `npm run check` and `npm run check:tauri`.
- Feature scaffolding validates input names, auto-registers required wiring, and has a smoke test.
- GitHub Actions runs frontend checks, scaffold smoke tests, and backend checks on pushes and pull requests to `main`.

No immediate required foundation improvements remain after the current audit. The items below are tracked as future hardening opportunities rather than blockers for AI-assisted development.

## Token Reduction Measures

- `npm run ai:context` gives a compact live summary instead of requiring broad source reads.
- `npm run check:quick` avoids tests and bundling while iterating.
- `npm run verify:architecture` reports a one-line success summary by default.
- `npm run verify:architecture:verbose` keeps detailed pass logs available when needed.
- `scripts/scaffold-feature.js` prints a short summary by default and supports `--verbose` for file-level detail.
- `rtk` commands remain the preferred way to collect concise command output.

## Required Verification

Before considering AI-generated changes complete, run:

```bash
npm run check:quick
npm run check
npm run check:tauri
```

For changes to the scaffolder, also run:

```bash
npm run test:scaffold
```

## Current Residual Risks

- `verify-architecture.js` still uses regex-based parsing. It is acceptable for the current code shape, but a TypeScript/Rust parser would be stronger if the codebase grows.
- Desktop behavior still depends on manual verification for tray behavior, global shortcuts, and platform-specific window behavior.
- Voice to Text remains intentionally `placeholder`; the architecture prevents OS-side shortcut registration while it is inactive.
