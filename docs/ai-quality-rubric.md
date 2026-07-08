# AI Development Quality Rubric

This rubric defines the target bar for AI-led development in Mint. A change is ready for handoff only when the applicable evidence is current and directly supports the score.

## 100-Point Standard

- **Orientation and scope control (15 pts)**: The agent used `npm run ai:context`, read only the relevant primary docs/code, and kept the change scoped to the requested outcome.
- **Architecture alignment (20 pts)**: Feature work follows the static feature-module architecture, uses the scaffolder for new tools, keeps TypeScript/Rust settings in sync, and avoids dynamic plugin registries or untyped JSON dispatch.
- **Type and side-effect safety (15 pts)**: TypeScript avoids `any` escapes, Rust commands are typed, React state updates do not hide async side effects, and placeholder features do not register OS-level side effects.
- **Mock and browser workflow (10 pts)**: Browser-only mocks and Vitest setup stay synchronized with frontend invokes and default settings.
- **Verification evidence (20 pts)**: `npm run check:quick` passes during iteration, and `npm run check:all` passes before handoff when the Rust/Tauri environment is available. If a gate cannot run, the blocker is explicit and concrete.
- **Documentation and review readiness (10 pts)**: README, AI development docs, architecture docs, audit notes, and PR checklist remain aligned with the actual workflow.
- **User-facing quality (10 pts)**: UI changes are visually coherent, accessible enough for the current app standard, and verified in the browser or desktop shell when behavior is visible.

## Required Evidence

Before claiming a 100-point result, collect current evidence for every applicable item:

```bash
npm run ai:context
npm run check:quick
npm run check:all
```

For UI or desktop behavior, add manual evidence from `docs/manual-verification.md` for the affected workflow. For scaffolder changes, `npm run test:scaffold` must pass, either directly or as part of `npm run check:all`.

## Residual Risk Policy

Known residual risks are acceptable only when they are documented in `docs/ai-foundation-audit.md` or the PR's residual-risk section. A residual risk cannot contradict a required architecture rule or a failing automated gate.
