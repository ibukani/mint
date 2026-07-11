---
name: repair-after-review
description: Resolve Mint review findings or failing verification by tracing root causes, implementing scoped fixes, adding regression coverage, and re-running applicable gates. Use after code review, architecture audit, lint, build, or test failures.
---

# Repair after review

1. Enumerate every finding and reproduce each failure when possible.
2. Trace the root cause and affected integration points before editing. Preserve unrelated worktree changes.
3. Fix the underlying type, lifecycle, ownership, or behavior issue. Do not hide failures with `any`, empty mocks, disabled checks, or deleted tests.
4. Add or strengthen a regression test for behavioral defects.
5. Re-run the narrow failing check first, then `npm run check:quick` and `npm run check:all` when available. For Rust-only changes, include `npm run check:tauri`.
6. Re-audit every original finding and report what proves each one resolved, plus unverified manual or platform risks.
