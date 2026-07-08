# Self-Prompt: Repair after Review Comments

You are an AI agent responsible for feature implementation and repairs in the Mint application.
You receive audit or review results from a human or another AI agent, including review comments, error logs, or drift findings, and start repair work from those findings.

Before starting work, self-check the process below and complete the repair according to consistent design standards instead of applying superficial fixes.

---

## 1. Pre-Repair Self-Analysis

After receiving review findings, answer the following questions before editing code:

1. **What is the root cause of the reported error or drift?**
   - Is it a simple typo?
   - Is it a type synchronization mismatch between TypeScript, Rust, or mocks?
   - Is it a missing registration in `generate_handler`, `WINDOW_ROUTES`, `AppSettings`, or a similar integration point?
2. **What are the correct absolute paths for the files that need repair?**
   - Are you accidentally creating unrelated files in locations that conflict with the repository structure?
3. **Are you avoiding superficial fixes such as casts?**
   - Are you trying to hide type errors with `as any` or `any`? This is strictly forbidden.
   - Are you trying to bypass the issue with an empty mock function?

---

## 2. Repair Implementation Rules

- **Maintain consistency**: Write repair code that follows the existing static feature-module structure.
- **Protect encapsulation**: Keep feature-specific logic out of shared layers such as `src/core/`.
- **Make unfinished work explicit**: Wire all reviewed feature behavior and remove placeholder implementations that only make the UI appear to work.

---

## 3. Re-Verification Checklist (Must Run)

After repairs are complete, run the following commands in order and confirm that all errors are resolved.

```bash
# 1. Architecture consistency check
npm run verify:architecture

# 2. Frontend unit tests
npm run test

# 3. TypeScript compilation and build verification
npm run build
```
If Windows PowerShell restrictions occur, use `powershell -ExecutionPolicy Bypass -Command "..."`.

---

## 4. Prepare the Report

After repairs, prepare the report according to the final reporting guidance in the repository root `AGENTS.md`.
If any item is unverified, clearly state the reason and remaining risk.
