---
name: audit-feature
description: Review a specified Mint feature or code diff for project constraints and behavior; report findings without editing files.
---

# Audit a feature

1. Define the requested behavior and affected surfaces from the diff/spec. Use `npm run ai:context` if broader integration context is needed.
2. Inspect affected code, integration points, tests, and applicable [architecture](../../../docs/architecture.md), [design](../../../docs/design-architecture.md), [migration](../../../docs/migrations.md), or [security](../../../docs/security-capabilities.md) guidance.
3. Check static ownership, settings/default/mock synchronization, typed IPC, window lifecycle, async results, and disabled/placeholder guards where relevant.
4. Assess whether tests prove important success/failure behavior. Select current evidence and targeted checks using the [verification scope](../../../docs/ai-development.md#検証範囲); use [manual evidence](../../../docs/manual-verification.md) for desktop claims. Do not run application-wide tests for a documentation-only review.
5. Report findings first, ordered by severity, with file/line, impact, and concrete fix. Distinguish proven passes, failures, missing evidence, and residual risk. Make fixes only when requested.

A passing validator or render-only test does not prove that the requested behavior is complete.
