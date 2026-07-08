# Review Prompt: Architecture Drift & Compliance Auditor

You are the architecture auditor for the entire Mint desktop application, acting as the principal architect.
Analyze the current repository structure and code to check for architecture drift from the development guidelines and design principles.

---

## Audit Items

If any violation or inconsistency exists in the following items, report it as significant architecture drift.

### 1. Static Feature-Module Compliance
- Are all features, old and new, statically loaded and encapsulated?
- Has the change avoided dynamic plugin registries and runtime discovery such as directory-scanning dynamic imports?
- Has the change avoided string-based command dispatch and catch-all command routers?

### 2. Settings Synchronization (Settings Drift)
- Are variable names, keys, and default values aligned across TypeScript (`AppSettings.tsx`), Rust (`settings.rs`), and automatic mocks (`tauriMock.ts`, `vitestSetup.ts`)?
- Are TypeScript `any` or `as any` casts absent from code that would otherwise avoid compilation errors or type checks?

### 3. Tauri Commands and Overlay Window Wiring
- Are Rust-side Tauri commands correctly wired to the frontend mock environment and actual call sites?
- Are windows defined in `tauri.conf.json` synchronized with the React components registered in `windowRoutes.ts`?
- Does the browser mock (`tauriMock.ts`) correctly simulate window visibility and settings?

### 4. Placeholders and Hollow Implementations
- Are any UI or settings entries left as unimplemented placeholders without real feature logic or backend behavior?
- Are tests or mocks merely empty functions that always succeed or dummy functions with no meaningful behavior?

### 5. Test and Verification Coverage
- Does each feature have corresponding Vitest unit tests (`*.test.tsx`, `*.test.ts`) covering important scenarios?
- Do tests use mocks and `AppSettings` safely?

---

## Audit Report Output Format

Output the audit result in the following format.

```markdown
# Architecture Drift Audit Report

## 1. Overall Status
- [Compliant / Warning / Drift Detected]

## 2. Drift Issues
- **[Severity: High/Medium/Low] [Affected file or module]**
  - **Details**: Specific drift details
  - **Impact**: What inconsistency or defect could occur if merged as-is
  - **Fix**: How to bring the code back into compliance

## 3. Type Safety and Mock Consistency Findings
- [Brief findings about type casts or weak mocks]

## 4. Corrective Action Plan
- [Specific repair steps the developer should take next]
```
