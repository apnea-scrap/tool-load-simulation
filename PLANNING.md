# Plan: Split, Test, and Deploy Fin Bending Tool

This document outlines how to restructure the **fin bending calculator** so it’s easy to test, embed in MkDocs, and distribute via GitHub Pages.

---

## 1. Restructure the Tool

### Current
- A single HTML file that contains markup, styles, logic, and rendering.

### Target
- **HTML**: minimal, slim, only includes containers + links to JS/CSS.
- **CSS**: in `fin-bending.css`.
- **JavaScript** split into:
  - `fin-bending-core.js` → pure functions (math + logic only).
  - `fin-bending.js` → DOM bindings, rendering, event listeners, uses `fin-bending-core`.

### File Layout
```
tool-load-simulation/
  docs/
    index.html
    fin-bending.css
    fin-bending.js
    fin-bending-core.js
  tests/
    fin-bending-core.test.js
```

### Example `index.html`
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tapered Fin Bending Calculator</title>
  <link rel="stylesheet" href="fin-bending.css">
</head>
<body>
  <h3>Tapered Fin Bending Calculator</h3>
  <div id="fin-bending-app"></div>
  <script src="fin-bending-core.js"></script>
  <script src="fin-bending.js"></script>
</body>
</html>
```

---

## 2. Core Functions (`fin-bending-core.js`)

This file should export **pure functions** that take parameters and return numbers or arrays.

Functions:
- `effectiveThicknessAt(x, params)`
- `computeTipAngle(P, params)`
- `solveForLoad(params)`
- (optional) helpers like `computeShape(params)` returning `(X[], Y[])`

No DOM or canvas code inside.

---

## 3. UI Bindings (`fin-bending.js`)

This file should:
- Inject the HTML sliders and canvases into `#fin-bending-app`.
- Listen for slider changes.
- Call into `fin-bending-core.js` functions.
- Draw charts and laminate views on `<canvas>`.

---

## 4. Tests

We want tests for the **core math**.

Use [Jest](https://jestjs.io/) or [Vitest](https://vitest.dev/). Example with Jest:

**tests/fin-bending-core.test.js**
```javascript
import { computeTipAngle, solveForLoad } from "../docs/fin-bending-core.js";

test("tip angle increases with load", () => {
  const params = { layersFoot: 4, layersTip: 2, L: 250, b: 180, E: 32, thickness: 0.35 };
  const angle1 = computeTipAngle(10, params);
  const angle2 = computeTipAngle(50, params);
  expect(angle2).toBeGreaterThan(angle1);
});

test("solveForLoad gives ~90 degree tip angle", () => {
  const params = { layersFoot: 4, layersTip: 2, L: 250, b: 180, E: 32, thickness: 0.35 };
  const load = solveForLoad(params);
  const angle = computeTipAngle(load, params);
  expect(angle).toBeGreaterThanOrEqual(90);
});
```

Run tests:
```bash
npm install --save-dev jest
npx jest
```

---

## 5. GitHub Pages Deployment

We’ll serve `/docs` from this repo so the tool is browsable and embeddable.

### Enable Pages
- In repo settings → Pages → “Deploy from branch” → `/docs` folder on `main`.

### GitHub Action
`.github/workflows/deploy.yml`:
```yaml
name: Deploy Fin Tool to Pages
on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run tests
        run: |
          npm install
          npx jest

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./docs
```

This:
1. Checks out code.
2. Runs tests on `fin-bending-core.js`.
3. Deploys `docs/` folder to Pages.

Your tool will be available at:
```
https://USERNAME.github.io/tool-load-simulation/
```

---

## 6. Embedding in MkDocs (`apnea-scrap-lab`)

Use the [macros plugin](https://mkdocs-macros-plugin.readthedocs.io/).

### Macro (`overrides/macros/fin_macros.py`)
```python
def define_env(env):
    @env.macro
    def fin_bending_tool():
        return """
<div id="fin-bending-app"></div>
<link rel="stylesheet" href="https://USERNAME.github.io/tool-load-simulation/fin-bending.css">
<script src="https://USERNAME.github.io/tool-load-simulation/fin-bending-core.js"></script>
<script src="https://USERNAME.github.io/tool-load-simulation/fin-bending.js"></script>
"""
```

### Usage in Markdown
```markdown
# Fin Bending Calculator

{{ fin_bending_tool() }}
```

---

## ✅ Summary

- Split tool into **core math** + **UI binding**.
- Add **unit tests** for math in `tests/`.
- Deploy `/docs` with GitHub Pages.
- Use a **MkDocs macro** to embed the live tool in `apnea-scrap-lab`.
