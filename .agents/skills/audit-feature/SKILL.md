---
name: audit-feature
description: Audit a Mint feature or feature diff for architecture, design ownership, settings and IPC synchronization, side-effect safety, tests, and user-visible behavior. Use for readiness reviews, architecture drift checks, or completion audits.
---

# Audit a feature

Audit from current evidence, not intent.

1. Define the requested behavior and affected surfaces from the diff/spec.
2. Run `npm run ai:context` and inspect only the affected feature, shared integration points, tests, and applicable docs.
3. Check static module ownership, settings/default/mock sync, typed IPC registration, window routing, design/CSS ownership, async side effects, and placeholder shortcut guards.
4. Confirm tests assert important success and failure behavior; do not count render-only or always-success mocks as full coverage.
5. Run `npm run check:quick`, then the narrow tests, and `npm run check:all` when available. Perform applicable manual checks from `docs/manual-verification.md`.
6. Report findings first, ordered by severity, with file/line, impact, and concrete fix. Distinguish proven passes, failures, missing evidence, and residual risk.

A passing validator is necessary evidence, not proof that the requested feature behavior is complete.
