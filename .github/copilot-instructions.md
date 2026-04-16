# Copilot Instructions — Thematic Analysis App

## Project Identity

This is a **React-based visual workspace** for **Braun & Clarke Reflexive Thematic Analysis** — a qualitative research methodology. It is **not** a clinical tool, diagnostic instrument, or therapeutic application. All language, documentation, and features must reflect an academic research context.

**Reference methodology:** Braun, V. & Clarke, V. (2006). Using thematic analysis in psychology. *Qualitative Research in Psychology, 3*(2), 77–101. And their updated reflexive TA framework (2019+).

---

## Architecture Overview

| Layer | Technology | Notes |
|---|---|---|
| UI Framework | React 19 (CRA / react-scripts) | StrictMode enabled |
| Styling | Tailwind CSS 3 + inline styles | Tailwind for utilities; inline styles for dynamic/animated values |
| State | `useReducer` + React Context (`GraphContext`) | Single global store; lazy initializer for localStorage restore |
| Graph layout | D3 v7 force simulation | Custom `forceSimulation.js` factory; physics params persisted separately |
| Animation | Framer Motion 12 | Node enter/hover/connecting animations |
| File import | XLSX + PapaParse | CSV, XLSX, XLS; flexible header matching via `HEADER_MAP` |
| Export | html2canvas + jsPDF | Targets `#canvas-export-target` div; 2× scale, dark background |
| Unit tests | Jest + @testing-library/react | `src/**/*.test.js` |
| E2E tests | Playwright (Chromium only) | `e2e/app.spec.js`; auto-starts dev server on port 3000 |

---

## Key Files

```
src/
  App.js                        Root composition; all modal/panel open state lives here
  context/GraphContext.js       Global reducer + localStorage persistence (lazy initializer)
  components/
    Canvas.js                   D3 simulation, SVG edges, React node layer, pan/zoom
    Toolbar.js                  All primary action buttons
    PhysicsPanel.js             Collapsible sidebar with D3 force sliders
    ContextMenu.js              Right-click menu (auto-dismiss, viewport-aware)
    QuoteTooltip.js             Floating tooltip on code hover
    nodes/ThemeNode.js          160px circular node; keyboard-accessible
    nodes/CodeNode.js           130px circular node
    modals/ImportModal.js       Two-step wizard: upload → preview → confirm
    modals/CodeEditModal.js     Edit code label, quote, source
    modals/ThemeEditModal.js    Edit theme name + color; cascades color to codes
  utils/
    importUtils.js              parseFile(), buildGraphFromRows(), generateTemplate()
    exportUtils.js              exportToPng(), exportToPdf()
    forceSimulation.js          createSimulation() factory; updateData(), updateParams()
e2e/
  app.spec.js                   13 Playwright E2E tests
playwright.config.js            Chromium, headless, webServer auto-start
```

---

## State Shape

```js
// GraphContext initial state
{
  nodes: [],   // { id, type, label, x, y, color, quote?, source?, primaryThemeId? }
  edges: [],   // { id, source, target }
}
```

**Node types:**
- `"theme"` — `{ id, type, label, color, x, y }`
- `"code"` — `{ id, type, label, quote, source, primaryThemeId, color, x, y }`

**Reducer actions:** `ADD_NODES`, `ADD_NODE`, `UPDATE_NODE`, `DELETE_NODE`, `ADD_EDGE`, `DELETE_EDGE`, `SET_GRAPH`, `CLEAR`

**localStorage keys:**
- `thematic_analysis_graph_v1` — full graph state
- `thematic_analysis_physics_v1` — physics simulation parameters

---

## Domain Terminology

Always use qualitative research terminology, not clinical language:

| Use | Avoid |
|---|---|
| researcher / analyst | clinician / therapist / practitioner |
| participant | patient / client |
| qualitative data | assessment data |
| coded excerpt / quote | symptom / case note |
| theme / thematic map | diagnosis / formulation |
| Braun & Clarke TA | CBT / clinical framework |
| reflexive thematic analysis | clinical analysis |

---

## Coding Conventions

- **Component style:** Functional components only; no class components.
- **Styling:** Use Tailwind utility classes for layout/spacing; use inline `style` props when values are dynamic or animation-driven.
- **State updates:** Always go through the `graphReducer` via `dispatch`. Never mutate context state directly.
- **D3 integration:** D3 controls node *positions* (`x`, `y`). React controls *rendering*. Never let D3 manipulate the DOM directly — use `onTick` callbacks to sync positions into React state.
- **Export target:** The canvas export always targets `document.getElementById('canvas-export-target')`. Do not change this ID without updating `exportUtils.js` and `App.js`.
- **Physics params:** Physics sliders in `PhysicsPanel` must call `onChange(updatedParams)` *and* `savePhysicsParams(updatedParams)`. The simulation reads from `physicsParams` prop reactively via a `useEffect` in `useDragAndSimulation`.
- **LocalStorage persistence:** Uses a **lazy initializer** on `useReducer` (not a restore effect) to avoid race conditions between save and restore on mount.
- **Test isolation:** Every Playwright test clears localStorage in `beforeEach`. Wait 300ms after opening PhysicsPanel before interacting (CSS transition).

---

## Import Pipeline

The import wizard (`ImportModal` → `importUtils`) supports:
- Flexible column headers via `HEADER_MAP` (e.g., `Source`, `Participant` → source field)
- Required column: `Code` / `Code (Comment)` — rows without a code value are skipped
- Optional columns: `Source`, `Quoted Text` / `Quote`, `Preliminary Theme` / `Theme`
- Existing theme names are reused; new unique labels create new theme nodes
- Sample file: `docs/samples/thematic-import-sample.csv`

---

## Running Tests

```bash
npm test                  # Jest unit tests (4 tests, 2 suites)
npm run test:e2e          # Playwright E2E (13 tests, Chromium)
npx playwright test --reporter=list   # verbose E2E output
```

---

## Bugs Fixed (History)

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | High | Export buttons were no-ops — no element with `id="canvas-export-target"` | Added `id` to Canvas root div |
| 2 | High | Physics sliders didn't affect the simulation after init | `useDragAndSimulation` now accepts `physicsParams` prop and reactively calls `updateParams()` |
| 3 | Medium | Deleting a theme left codes with stale `primaryThemeId` | `DELETE_NODE` reducer unassigns affected codes |
| 4 | High | localStorage persistence race condition on mount | Replaced effect-based restore with `useReducer` lazy initializer |

---

## What This App Is NOT

- Not a clinical assessment or therapy tool
- Not a diagnostic instrument
- Not connected to any patient record system or health data
- Not intended for use with real client or patient information
- Terminology and output are for academic/research purposes only
