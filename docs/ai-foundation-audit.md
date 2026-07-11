# AI Development Foundation Audit

This document records the current evaluation of Mint's AI-first development foundation.

## Status

The project is in a good state for AI-assisted iteration:

- Static feature-module architecture is documented and enforced.
- Frontend, backend, mock, settings, window, and IPC wiring are checked by `npm run verify:architecture`.
- Fast orientation is available through `npm run ai:context`.
- Fast local feedback is available through `npm run check:quick`.
- AI foundation drift is checked by `npm run check:ai-foundation`, covering required scripts, Node version alignment, core AI docs, CI gates, and the PR template checklist.
- `docs/ai-quality-rubric.md` defines the 100-point quality bar and required evidence for AI-led changes.
- Full local release verification is available through `npm run check:all`.
- Full frontend and backend gates are available through `npm run check` and `npm run check:tauri`.
- Feature scaffolding validates input names, auto-registers required wiring, and has a smoke test.
- GitHub Actions runs frontend checks, scaffold smoke tests, and backend checks on pushes and pull requests to `main`.

No immediate required foundation improvements remain after the current audit. The items below are tracked as future hardening opportunities rather than blockers for AI-assisted development.

## Token Reduction Measures

- `npm run ai:context` gives a compact live summary instead of requiring broad source reads.
- `npm run check:quick` avoids tests and bundling while iterating.
- `npm run verify:architecture` reports a one-line success summary by default.
- `npm run verify:architecture:verbose` keeps detailed pass logs available when needed.
- `npm run check:ai-foundation` catches stale AI development infrastructure before agents depend on it.
- `docs/ai-quality-rubric.md` makes completion criteria explicit instead of relying on ad hoc judgment.
- `scripts/scaffold-feature.js` prints a short summary by default and supports `--verbose` for file-level detail.
- `rtk` commands remain the preferred way to collect concise command output.
- Repository workflows are exposed as concise, kebab-case skills under `.agents/skills/`; `npm run ai:context` lists them from the live worktree.
- `npm run check:ai-foundation` validates required skills, their UI metadata, naming, and unfinished TODO leakage.
- Legacy self-prompts were removed in favor of discoverable skills to avoid maintaining duplicate instructions.

## Required Verification

Before considering AI-generated changes complete, run:

```bash
npm run check:quick
npm run check:ai-foundation
npm run check:all
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
- Voice to Text now supports typed file transcription through an OpenAI-compatible API. Live microphone recording and automatic clipboard insertion still require manual design and platform verification.
