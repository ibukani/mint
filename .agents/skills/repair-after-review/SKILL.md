---
name: repair-after-review
description: Fix specified Mint review findings or reproducible verification failures and verify the affected behavior.
---

# Repair after review

1. Track the requested findings and reproduce failures where possible. Trace the affected integration points; preserve unrelated worktree changes.
2. Fix the underlying type, lifecycle, ownership, or behavior issue. Do not hide failures with unsafe casts, empty mocks, disabled checks, or deleted behavioral tests.
3. Add or strengthen regression coverage for behavioral defects; formatting-only corrections do not need new behavioral tests.
4. Rerun the failing targeted check, then select the affected frontend/Rust/scaffold gates using the [verification scope](../../../docs/ai-development.md#検証範囲). Do not repeat child gates already covered by a successful parent.
5. Re-audit every requested finding and report what proves it resolved. Use [desktop verification](../../../docs/manual-verification.md#ui変更時の必須確認) for UI/desktop fixes and disclose remaining manual/platform risks.
