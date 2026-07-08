---
name: repair-after-review
description: Systematic process for addressing PR review comments, linting issues, or verification failures.
---

# `repair-after-review` Skill

This skill explains how to systematically fix and re-verify review requests from code review, whether from humans or other AI agents, as well as errors and build failures from verification commands.

## Purpose
- Resolve all reported items comprehensively and avoid superficial, temporary fixes.
- Prevent regressions, reintroductions of old behavior, and new bugs caused by repairs.

---

## Likely Files to Touch
- **All files mentioned by the review or failure**
- **Test suites**: `src/**/*.test.ts`, `src/**/*.test.tsx`
- **Work tracking**: [task.md](../../../task.md), if it exists

---

## Required Architecture Rules
1. **Fix the root cause**: Do not hide compile errors or test failures with casts such as `as any`, by deleting mocks, or through similar tactics. Identify and resolve the root cause.
2. **Cover every reported item**: Address every review comment and warning without skipping any.
3. **Run regression tests**: After repairs, rerun all automatic verification and tests in the affected scope.

---

## Procedure

### Step 1: List Findings and Failure Points
Organize the items that need repair from error logs or review comments.
When useful, add subtasks to the task list (`task.md`) for tracking.

### Step 2: Analyze Root Causes and Plan Repairs
Do not merely rewrite the error message or reported location. Analyze why the error occurred, such as a type mismatch, unwired mock, or missing function argument.
Identify the affected scope, including call sites and Rust-side type definitions, and make a consistent repair.

### Step 3: Repair the Code
Repair the code while following the architecture rules.
- Recheck that type errors are not being suppressed by casts.
- Do not treat placeholders or unfinished behavior as complete.

### Step 4: Run Re-Verification
After repairs, always run the following verification commands to confirm that other areas were not broken.
```bash
npm run verify:architecture
npm run test
npm run build
```
If Windows PowerShell errors occur, run `powershell -ExecutionPolicy Bypass -Command "..."`.

### Step 5: Report the Repair Result
Follow the final reporting format and report what changed, how it was repaired, verification results, and any remaining risks.

---

## Definition of Done
- [ ] Every reported error and comment is fixed.
- [ ] All verification commands (`verify:architecture`, `test`, `build`) pass without warnings or errors.
- [ ] The repair introduces no new architecture violations or `as any` casts.

---

## Required Verification
- `npm run verify:architecture`
- `npm run test`
- `npm run build`
- If the changed area includes the Rust backend, run `cargo check` / `cargo test`.

---

## Common Failures
- **Superficial fixes**: Casting a problematic variable with `as any` to clear a type error instead of correcting the type definitions.
- **Ignoring some findings**: Fixing only the easiest subset of multiple findings and reporting the work as complete while leaving the rest unresolved.
- **Skipping retests**: Reporting immediately after editing the reported location without running tests, leaving import errors or similar failures in other files.
