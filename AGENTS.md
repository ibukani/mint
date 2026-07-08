# Repository Guidelines

## Project Structure & Module Organization
This repository is a Tauri 2 desktop app with a React 19 + TypeScript frontend.

- `src/` contains the React application entry points and UI code. `main.tsx` mounts the app, and `App.tsx` currently contains the main screen.
- `src/assets/` stores frontend assets imported by React components.
- `public/` stores static files served directly by Vite, such as logos.
- `src-tauri/` contains the Rust/Tauri application shell. Rust commands and app setup live in `src-tauri/src/`; Tauri configuration lives in `src-tauri/tauri.conf.json`.
- Root TypeScript and Vite config files (`tsconfig*.json`, `vite.config.ts`) control frontend builds.

## Build, Test, and Development Commands
Use the package scripts in `package.json`:

- `npm run dev` starts the Vite frontend development server.
- `npm run build` runs `tsc` and then builds the Vite frontend.
- `npm run preview` serves the built frontend locally.
- `npm run tauri -- dev` runs the full Tauri desktop app in development.
- `npm run tauri -- build` builds the distributable desktop app.

For Rust-only checks, run commands from `src-tauri/`, for example `cargo check` or `cargo test`.

## Coding Style & Naming Conventions
Frontend code uses TypeScript modules, React function components, 2-space indentation, double quotes, and semicolons. Name React components in `PascalCase` and hooks/state variables in `camelCase`.

Rust code follows standard `rustfmt` formatting with 4-space indentation. Use `snake_case` for functions, variables, and Tauri command names. Keep Tauri commands small and register them in `tauri::generate_handler!`.

## Testing Guidelines
Frontend component tests are managed by Vitest. To run tests, use `npm run test` or `npm run test:watch`. Place test files near the implementation as `*.test.ts` or `*.test.tsx`.
For Rust logic, prefer unit tests in the relevant module under `src-tauri/src/` and run them with `cargo test`.

Before opening a pull request, run `npm run check` and `npm run check:tauri` to ensure typechecks, biome lint, unit tests, architecture validation, and builds all pass.

## Commit & Pull Request Guidelines
Local Git history is not available in this workspace, so use clear, imperative commit subjects such as `Add greeting command` or `Refine Tauri window config`.

Pull requests should include a short description, testing notes, linked issues when applicable, and screenshots or screen recordings for visible UI changes. Keep changes scoped: separate frontend UI work, Rust command changes, and configuration updates when practical.
