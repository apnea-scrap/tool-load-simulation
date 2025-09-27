# Repository Guidelines

## Project Structure & Module Organization
Calculator code lives in `docs/`: `fin-bending-core.js` exposes the math API shared by both browser and Jest, `fin-bending-render.js` drives DOM updates for `index.html`, and `fin-bending.css` scopes styles under `#fin-bending-app`. The Jest suite resides in `tests/fin-bending-core.test.js` and should only exercise pure helpers. Treat `node_modules/` as generated; leave it untouched.

## Build, Test, and Development Commands
Install dependencies with `npm install` (Jest 24 + Node 8 support). Run `npm test` to execute the suite. For manual QA, open `docs/index.html` directly or serve it (`npx http-server docs` or `python3 -m http.server 8000 --directory docs`) so relative assets load correctly.

## Coding Style & Naming Conventions
Keep code ES2015-friendly with two-space indentation and semicolons. Prefer `const`/`let`, but respect existing `var` usage where compatibility matters. Name helpers descriptively (`computeTipAngle`, `createLaminateStackSvg`). Browser bundles stay kebab-case, CSS selectors remain scoped beneath `#fin-bending-app`, and avoid adding dependencies that require a build step.

## Testing Guidelines
Extend `tests/fin-bending-core.test.js` alongside any logic change. Use plain-English test names and reuse factories like `createParams()` for fixtures. Cover new branches in math helpers and keep DOM concerns out of unit tests. Run `npm test` before pushing and ensure it passes on Node ≥ 8.17.

## Commit & Pull Request Guidelines
Follow the repository’s Conventional Commit pattern (`feat:`, `fix:`, `chore:`) and keep each commit focused. PRs need a succinct summary, linked issue or context, UI screenshots when visuals change, and an explicit `npm test` result.
