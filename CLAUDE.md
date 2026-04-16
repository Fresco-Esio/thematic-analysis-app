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
| Design | Neo-Brutalist — Bricolage Grotesque font, `#f0ebe3` cream canvas, `#0f0d0a` near-black, `#dc2626` red accent, hard box-shadows |
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
  App.js                        Root composition; all modal/panel/search/focus state lives here
  context/GraphContext.js       Global reducer + localStorage (lazy initializer pattern)
  components/
    Canvas.js                   D3 simulation, SVG edges, React node layer, pan/zoom, focus-view zoom
    Toolbar.js                  All primary action buttons + expandable search bar
    PhysicsPanel.js             Collapsible sidebar, D3 force sliders, 0.25s CSS transition
    ContextMenu.js              Right-click menu (role="menu"; auto-dismiss; viewport-aware)
    QuoteTooltip.js             Floating tooltip on code hover (AnimatePresence fade)
    nodes/
      GraphNode.js              Unified node component — theme or code variant based on node.type
    modals/
      ImportModal.js            Two-step wizard: upload → preview → confirm; scrollable (max-h-[90vh])
      CodeEditModal.js          Edit code label, quote, source; role="dialog"; Escape closes
      ThemeEditModal.js         Edit theme name + color; cascades to codes; role="dialog"
  utils/
    importUtils.js              parseFile(), buildGraphFromRows(), generateTemplate()
    exportUtils.js              exportToPng(), exportToPdf()
    forceSimulation.js          createSimulation() factory; chainable alpha(val) and restart()
    nodeUtils.js                Node sizing constants and color helpers
    motionConfig.js             Shared Framer Motion animation variants
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

## App-Level UI State (App.js)

| State | Type | Purpose |
|---|---|---|
| `importOpen` | boolean | ImportModal visibility |
| `codeEditId` | string\|null | CodeEditModal target node id |
| `themeEditId` | string\|null | ThemeEditModal target node id |
| `connectMode` | boolean | Edge-drawing mode active |
| `physicsOpen` | boolean | PhysicsPanel visibility |
| `searchOpen` | boolean | Toolbar search bar expanded |
| `searchQuery` | string | Current search string |
| `searchFilters` | `{themes, codes}` | Node type filter toggles |
| `focusThemeId` | string\|null | Active focus-view theme; null = no focus |

---

## Critical Conventions

- **State:** All updates go through `graphReducer` via `dispatch`. Never mutate context directly.
- **D3 / React split:** D3 owns `x`/`y` positions via force simulation. React owns rendering. Never let D3 touch the DOM.
- **Export ID:** Canvas root div has `id="canvas-export-target"`. `exportUtils.js` and `App.js` both depend on this — do not rename.
- **Physics reactivity:** `useDragAndSimulation(nodes, edges, onTick, physicsParams)` — accepts `physicsParams` as a prop and has a `useEffect` calling `simulation.current.updateParams(physicsParams)` on changes.
- **Persistence:** `useReducer` uses a **lazy initializer** (third argument) to read localStorage synchronously before first render. Do not replace this with an effect-based restore — it causes a race condition where the save effect fires with empty state before the restore dispatches.
- **Components:** Functional components only. No class components.
- **Styling:** Tailwind for layout/spacing. Inline `style` for dynamic or animation-driven values. Never use `var(--css-var)` inside Tailwind arbitrary value syntax (e.g. `shadow-[...]`) — JIT cannot resolve them at build time.
- **PhysicsPanel transition:** The panel has a 0.25s CSS `width` transition. Wait 300ms after opening before interacting in tests.
- **Modal Escape handlers:** Each modal's `useEffect` for Escape must guard `if (!node) return;` before installing the listener, and include `node` in its deps array. This prevents a stale listener when the modal is closed.
- **Framer Motion nodes:** Use `motion.div` with `role="button"` — not `motion.button`. Playwright can detect `role="button"` reliably; `motion.button` has known interaction issues in tests.
- **Context menu ARIA:** Container has `role="menu"`, each item has `role="menuitem"`. E2E tests use `getByRole('menuitem', { name: /.../ })`.

---

## Canvas Features Added in UI Redesign

### Search
- `matchedNodeIds` — `useMemo` Set; nodes that match `searchQuery` + `searchFilters`
- Unmatched nodes render at 25% opacity when search is active
- Matched nodes get `4px 4px 0 #dc2626` red highlight shadow

### Alignment
- `handleAlign()` in App.js dispatches `UPDATE_NODE` for all nodes (radial layout: themes on outer ring, codes sub-ringed around their theme)
- After dispatch, calls `alignTriggerRef.current()` → `simulation.alpha(0.5).restart()`
- `forceSimulation.js` wraps D3 and exposes chainable `alpha(val)` and `restart()`

### Focus View
- `focusThemeId` state; passed as prop to Canvas
- `focusedNodeIds` — `useMemo` Set of theme + connected codes
- D3 zoom transitions (600ms cubic-bezier) to cluster bounding box when `focusThemeId` changes
- Non-focused nodes dim; "✕ Exit Focus" pill at canvas bottom; Escape also exits
- Context menu on theme nodes shows "⊙ Focus View" between Rename and Delete

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

- Supported formats: `.csv`, `.xlsx`, `.xls` (multi-sheet Excel supported)
- Flexible header matching via `HEADER_MAP` in `importUtils.js`
- Required column: `Code` / `Code (Comment)` — rows without a value are skipped
- Optional: `Source`, `Quoted Text` / `Quote`, `Preliminary Theme` / `Theme`
- Existing theme labels are reused; new unique labels create new theme nodes
- ImportModal is scrollable (`max-h-[90vh] overflow-y-auto`) for large preview tables

---

## Bug History (do not re-introduce)

| # | Issue | Fix applied |
|---|---|---|
| 1 | Export was a no-op — no `id="canvas-export-target"` element | Added `id` to Canvas root div |
| 2 | Physics sliders had no effect after simulation init | `useDragAndSimulation` now accepts `physicsParams` and calls `updateParams()` reactively |
| 3 | Deleting a theme left codes with stale `primaryThemeId` | `DELETE_NODE` reducer unassigns dependent codes |
| 4 | localStorage race condition on mount — save effect overwrote persisted data | Replaced effect-based restore with `useReducer` lazy initializer |
| 5 | Zoom-to-cluster effect missing `graphState.nodes` dep | Added `graphState.nodes` to the focus-view `useEffect` dep array |
| 6 | Unassigned codes cluster missing angle offset | Fixed `handleAlign()` — added `- Math.PI / 2` so unassigned ring starts at 12 o'clock |
| 7 | Modal Escape handler installed even when modal was closed | Added `if (!node) return;` guard and `node` to deps array in CodeEditModal and ThemeEditModal |
| 8 | ImportModal cut off when content exceeded viewport height | Added `max-h-[90vh] overflow-y-auto` to modal container div |
| 9 | E2E selectors broke after ARIA role additions | Updated `app.spec.js`: `getByRole('button')` → `getByRole('menuitem')`; `.border-t.border-slate-700` → `.border-t-2` |

---

## What This App Is NOT

- Not a clinical assessment or therapy tool
- Not a diagnostic instrument
- Not connected to any health record system
- Not intended for use with real patient or client data
- All terminology and output are for academic/research purposes only
