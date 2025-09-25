# Tool Load Simulation

This repository hosts the tapered fin bending calculator and its supporting assets. The tool now lives in the `docs/` directory so it can be published directly via GitHub Pages while remaining easy to develop and test locally.

## Prerequisites

- Node.js 8.17.0+ (the current setup relies on Jest 24, which supports Node 8). Using a newer Node release is recommended, but if you do so also bump the tooling stack accordingly.
- npm (bundled with Node).

If you use `nvm`, run `nvm use 8` (or later) before installing dependencies.

## Install Dependencies

```bash
npm install
```

This pulls in Jest for unit testing the core math module. A `package-lock.json` is checked in so repeated installs stay deterministic.

## Run Tests

```bash
npm test
```

The suite in `tests/fin-bending-core.test.js` exercises the pure calculation helpers exposed by `docs/fin-bending-core.js`.

## Work on the Calculator

1. Open `docs/index.html` in a browser (double-click or host the folder with any static server). The page loads `fin-bending-core.js` and `fin-bending.js`, which rebuild the original single-file calculator.
2. Edit logic inside `docs/fin-bending-core.js` (math) or `docs/fin-bending.js` (DOM/web rendering). Keep `beam_bending_calc.html` only as a historical snapshot.
3. Adjust styles in `docs/fin-bending.css`. All selectors are scoped under `#fin-bending-app` so embedding stays safe.
4. Re-run `npm test` after touching the core logic to make sure the numerical behaviour stays consistent.

## Recommended Workflow

- **Feature work:** modify the relevant file in `docs/`, run the tests, then reload the browser tab to verify the UI.
- **New formulas:** add helpers to `docs/fin-bending-core.js` and extend `tests/fin-bending-core.test.js` with expectations that pin down edge cases.
- **Publishing:** point GitHub Pages at the `docs/` folder (Settings → Pages) to serve the calculator without extra build steps.

Feel free to extend this README with project-specific cloning instructions or deployment notes once the remote repository layout is finalised.
