---
name: audit-feature
description: Guide to auditing an existing or newly added feature for architectural compliance, settings alignment, test presence, and code safety.
---

# `audit-feature` Skill

This skill provides a strict, objective procedure for auditing whether a new or existing feature module fully complies with the project's design principles and Static Feature-Module Architecture guidelines.

## Purpose
- Detect architecture drift when adding features or refactoring.
- Manually detect issues that static verification scripts may miss, such as remaining `as any` casts or incomplete mock implementations.

---

## Likely Files to Touch
- **All feature modules**: under `src/features/`
- **Settings schema**: [AppSettings.tsx](../../../src/core/context/AppSettings.tsx) and [settings.rs](../../../src-tauri/src/core/settings.rs)
- **Test code**: `src/**/*.test.ts` or `src/**/*.test.tsx`
- **Verification script**: [verify-architecture.js](../../../scripts/verify-architecture.js)

---

## Required Architecture Rules
1. **Verify before claiming completion**: Run the required verification commands before saying an item has been checked.
2. **Enforce type safety**: Check for remaining `as any` or `any` casts and confirm that type errors are not hidden in the connection between `types.ts` and `AppSettings`.
3. **Confirm full synchronization**: Frontend settings, backend settings, and browser mock settings must be synchronized.

---

## Procedure

### Step 1: Run Automatic Architecture Verification
First run the design consistency verification script and check for mechanical mismatches.
```bash
npm run verify:architecture
```
If Windows PowerShell restrictions occur, run `powershell -ExecutionPolicy Bypass -Command "npm run verify:architecture"`.

### Step 2: Check Static Type Declarations and Casts
Manually inspect the target feature source under `src/features/<feature_name>/` and audit the following:
- Is `as any` absent, especially in `AppSettings` update logic?
- Are React components declared with appropriate types such as `React.FC` where the repository expects that pattern?
- Are types defined in `types.ts` imported into `AppSettings.tsx`?

### Step 3: Check Settings Synchronization
- Property names in [AppSettings.tsx](../../../src/core/context/AppSettings.tsx), for example `myTool`
- Property names in [settings.rs](../../../src-tauri/src/core/settings.rs), for example `my_tool`
- Default settings objects in [tauriMock.ts](../../../src/core/mocks/tauriMock.ts)
Confirm that these are free of spelling errors and aligned in meaning and default values.

### Step 4: Check Browser Mock Wiring
- For every added Tauri command, confirm that [tauriMock.ts](../../../src/core/mocks/tauriMock.ts) implements dummy behavior.
- Confirm mocks are not empty implementations that only return `Promise.resolve()`, and that they reproduce state changes or realistic mock behavior.

### Step 5: Audit Test Code
- Confirm that `*.test.tsx` or `*.test.ts` exists near the target feature, for example under `src/features/<feature_name>/components/`.
- Confirm mocks are used correctly in tests and that the tests actually pass.

---

## Definition of Done
- [ ] The automatic verification command (`verify:architecture`) passes with zero errors.
- [ ] The target feature contains no `as any` or `any` usage.
- [ ] Test files exist and all tests pass with `npm run test`.
- [ ] Mocks are fully implemented and work in the browser development environment.

---

## Required Verification
1. `npm run verify:architecture`
2. `npm run test`
3. `npm run build`

---

## Common Failures
- **Stopping at a passing `verify:architecture` result**: Mechanical verification passes, but the actual UI component code still contains many `as any` casts.
- **Missing weak mocks**: Command-call mocks are empty, so settings reads and writes are not reflected in the mock when the app starts in a standalone browser.
- **Ignoring tests**: Test code is missing, or assertions are too weak and only verify rendering without behavior.
