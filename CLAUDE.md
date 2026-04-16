# CLAUDE.md — Thematic Analysis App

This file is read automatically by Claude Code at the start of every session.

---

## Project Identity

This is a **React-based visual workspace** for **Braun & Clarke Reflexive Thematic Analysis** — a qualitative research methodology for academic and research contexts. It is **not** a clinical tool, diagnostic instrument, or therapeutic application.

**Reference:** Braun, V. & Clarke, V. (2006). Using thematic analysis in psychology. *Qualitative Research in Psychology, 3*(2), 77–101. Updated reflexive TA framework (2019+).

---

## Essential Commands

```bash
npm start              # dev server on http://localhost:3000
npm test               # Jest unit tests (4 tests, 2 suites) — watchAll=false for CI
npm run build          # production bundle → build/
npm run test:e2e       # Playwright E2E (13 tests, Chromium, auto-starts dev server)
npx playwright test --reporter=list   # verbose E2E output
```

---

## Architecture

| Layer | Technology |
|---|---|
| UI | React 19, CRA (react-scripts 5) |
| Styling | Tailwind CSS 3 + inline styles for dynamic values |
| State | `useReducer` + React Context (`GraphContext`) |
| Graph layout | D3 v7 force simulation |
| Animation | Framer Motion 12 |
| File import | XLSX + PapaParse |
| Export | html2canvas + jsPDF |
| Unit tests | Jest + @testing-library/react |
| E2E tests | Playwright (Chromium only) |

---

## Key Files

```
src/
  App.js                        Root composition; all modal/panel open state lives here
  context/GraphContext.js       Global reducer + localStorage (lazy initializer pattern)
  components/
    Canvas.js                   D3 simulation, SVG edges, React node layer, pan/zoom
    Toolbar.js                  All primary action buttons
    PhysicsPanel.js             Collapsible sidebar, D3 force sliders, 0.25s CSS transition
    ContextMenu.js              Right-click menu (auto-dismiss, viewport-aware)
    QuoteTooltip.js             Floating tooltip on code hover
    nodes/ThemeNode.js          160px circular node; keyboard-accessible
    nodes/CodeNode.js           130px circular node
    modals/ImportModal.js       Two-step wizard: upload → preview → confirm
    modals/CodeEditModal.js     Edit code label, quote, source
    modals/ThemeEditModal.js    Edit theme name + color; cascades to codes
  utils/
    importUtils.js              parseFile(), buildGraphFromRows(), generateTemplate()
    exportUtils.js              exportToPng(), exportToPdf()
    forceSimulation.js          createSimulation() factory
e2e/app.spec.js                 13 Playwright E2E tests
playwright.config.js            Chromium, headless, webServer auto-start on port 3000
docs/samples/thematic-import-sample.csv   Sample import file
```

---

## State Shape

```js
// GraphContext
{ nodes: [], edges: [] }

// Node — theme
{ id, type: 'theme', label, color, x, y }

// Node — code
{ id, type: 'code', label, quote, source, primaryThemeId, color, x, y }

// Edge
{ id, source, target }
```

**Reducer actions:** `ADD_NODES` `ADD_NODE` `UPDATE_NODE` `DELETE_NODE` `ADD_EDGE` `DELETE_EDGE` `SET_GRAPH` `CLEAR`

**localStorage keys:**
- `thematic_analysis_graph_v1` — graph state
- `thematic_analysis_physics_v1` — physics params

---

## Critical Conventions

- **State:** All updates go through `graphReducer` via `dispatch`. Never mutate context directly.
- **D3 / React split:** D3 owns `x`/`y` positions via force simulation. React owns rendering. Never let D3 touch the DOM.
- **Export ID:** Canvas root div has `id="canvas-export-target"`. `exportUtils.js` and `App.js` both depend on this — do not rename.
- **Physics reactivity:** `useDragAndSimulation(nodes, edges, onTick, physicsParams)` — accepts `physicsParams` as a prop and has a `useEffect` calling `simulation.current.updateParams(physicsParams)` on changes.
- **Persistence:** `useReducer` uses a **lazy initializer** (third argument) to read localStorage synchronously before first render. Do not replace this with an effect-based restore — it causes a race condition where the save effect fires with empty state before the restore dispatches.
- **Components:** Functional components only. No class components.
- **Styling:** Tailwind for layout/spacing. Inline `style` for dynamic or animation-driven values.
- **PhysicsPanel transition:** The panel has a 0.25s CSS `width` transition. Wait 300ms after opening before interacting in tests.

---

## Domain Terminology

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

## Import Pipeline

- Supported formats: `.csv`, `.xlsx`, `.xls`
- Flexible header matching via `HEADER_MAP` in `importUtils.js`
- Required column: `Code` / `Code (Comment)` — rows without a value are skipped
- Optional: `Source`, `Quoted Text` / `Quote`, `Preliminary Theme` / `Theme`
- Existing theme labels are reused; new unique labels create new theme nodes

---

## Bug History (do not re-introduce)

| # | Issue | Fix applied |
|---|---|---|
| 1 | Export was a no-op — no `id="canvas-export-target"` element | Added `id` to Canvas root div |
| 2 | Physics sliders had no effect after simulation init | `useDragAndSimulation` now accepts `physicsParams` and calls `updateParams()` reactively |
| 3 | Deleting a theme left codes with stale `primaryThemeId` | `DELETE_NODE` reducer unassigns dependent codes |
| 4 | localStorage race condition on mount — save effect overwrote persisted data | Replaced effect-based restore with `useReducer` lazy initializer |

---

## What This App Is NOT

- Not a clinical assessment or therapy tool
- Not a diagnostic instrument
- Not connected to any health record system
- Not intended for use with real patient or client data
- All terminology and output are for academic/research purposes only
