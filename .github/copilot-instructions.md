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
| Design System | Neo-Brutalist | Bricolage Grotesque font; `#f0ebe3` cream canvas; `#0f0d0a` near-black; `#dc2626` red accent; hard box-shadows (no blur, no border-radius) |
| State | `useReducer` + React Context (`GraphContext`) | Single global store; lazy initializer for localStorage restore |
| Graph layout | D3 v7 force simulation | Custom `forceSimulation.js` factory; chainable `alpha()`/`restart()`; physics params persisted separately |
| Animation | Framer Motion 12 | Shared variants in `motionConfig.js`; node enter/hover/connecting animations |
| File import | XLSX + PapaParse | CSV, XLSX, XLS; multi-sheet Excel; flexible header matching via `HEADER_MAP` |
| Export | html2canvas + jsPDF | Targets `#canvas-export-target` div; 2× scale, dark background |
| Unit tests | Jest + @testing-library/react | `src/**/*.test.js` |
| E2E tests | Playwright (Chromium only) | `e2e/app.spec.js`; 13 tests; auto-starts dev server on port 3000 |

---

## Key Files

```
src/
  App.js                        Root composition; all modal/panel/search/focus state lives here
  context/GraphContext.js       Global reducer + localStorage persistence (lazy initializer)
  components/
    Canvas.js                   D3 simulation, SVG edges, React node layer, pan/zoom, focus-view zoom
    Toolbar.js                  All primary action buttons + expandable search bar
    PhysicsPanel.js             Collapsible sidebar with D3 force sliders (0.25s CSS width transition)
    ContextMenu.js              Right-click menu (role="menu"; auto-dismiss; viewport-aware)
    QuoteTooltip.js             Floating tooltip on code node hover (AnimatePresence fade)
    nodes/
      GraphNode.js              Unified node component — renders theme or code variant based on node.type
    modals/
      ImportModal.js            Two-step wizard: upload → preview → confirm; scrollable (max-h-[90vh])
      CodeEditModal.js          Edit code label, quote, source; Escape closes; role="dialog"
      ThemeEditModal.js         Edit theme name + color; cascades color to codes; role="dialog"
  utils/
    importUtils.js              parseFile(), buildGraphFromRows(), generateTemplate()
    exportUtils.js              exportToPng(), exportToPdf()
    forceSimulation.js          createSimulation() factory; exposes alpha(val), restart() chainable methods
    nodeUtils.js                Node sizing constants, color helpers
    motionConfig.js             Shared Framer Motion animation variants
e2e/
  app.spec.js                   13 Playwright E2E tests
playwright.config.js            Chromium, headless, webServer auto-start on port 3000
docs/
  samples/thematic-import-sample.csv   Sample import file
  plans/                               Implementation planning notes
```

---

## State Shape

```js
// GraphContext initial state
{
  nodes: [],   // theme: { id, type:'theme', label, color, x, y }
               // code:  { id, type:'code', label, quote, source, primaryThemeId, color, x, y }
  edges: [],   // { id, source, target }
}
```

**Reducer actions:** `ADD_NODES`, `ADD_NODE`, `UPDATE_NODE`, `DELETE_NODE`, `ADD_EDGE`, `DELETE_EDGE`, `SET_GRAPH`, `CLEAR`

**localStorage keys:**
- `thematic_analysis_graph_v1` — full graph state
- `thematic_analysis_physics_v1` — physics simulation parameters

---

## App-Level UI State (App.js)

All modal and panel open state lives in `App.js`:

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

## Canvas Features

### Search (Task 6)
- `matchedNodeIds` — `useMemo` Set; nodes matching query + filter
- Unmatched nodes render at 25% opacity when search is active
- Matched nodes get a `4px 4px 0 #dc2626` red highlight shadow

### Alignment (Task 7)
- `handleAlign()` in App.js dispatches `UPDATE_NODE` for all nodes instantly (radial layout)
- After dispatching, calls `alignTriggerRef.current()` which does `simulation.alpha(0.5).restart()`
- `forceSimulation.js` exposes chainable `alpha(val)` and `restart()` on the wrapper object

### Focus View (Task 8)
- `focusThemeId` state in App.js; passed to Canvas
- `focusedNodeIds` — `useMemo` Set of theme + its connected codes
- When active: non-focused nodes dim; D3 zoom transitions (600ms cubic-bezier) to the cluster bounding box
- Escape key or "✕ Exit Focus" pill button exits focus
- Context menu on theme nodes shows "⊙ Focus View" between Rename and Delete

---

## Coding Conventions

- **Component style:** Functional components only; no class components.
- **Styling:** Tailwind utility classes for layout/spacing; inline `style` props for dynamic/animated values. Never use CSS `var()` inside Tailwind arbitrary value syntax (e.g. `shadow-[...]`) — JIT cannot resolve them at build time.
- **State updates:** Always go through `graphReducer` via `dispatch`. Never mutate context state directly.
- **D3 integration:** D3 controls node *positions* (`x`, `y`). React controls *rendering*. Never let D3 touch the DOM — use `onTick` callbacks to sync positions into React state.
- **Export target:** Canvas export always targets `document.getElementById('canvas-export-target')`. Do not rename this ID without also updating `exportUtils.js` and `App.js`.
- **Physics reactivity:** `useDragAndSimulation` accepts `physicsParams` as a prop and has a `useEffect` that calls `simulation.current.updateParams(physicsParams)` on changes.
- **LocalStorage persistence:** Uses a **lazy initializer** on `useReducer` (not a restore effect) to avoid race conditions between save and restore on mount.
- **Modal Escape handlers:** Each modal's Escape `useEffect` must guard `if (!node) return;` before installing the listener. Add `node` to the deps array. This prevents stale listeners when the modal is closed.
- **Framer Motion:** Use `motion.div` with `role="button"` on nodes — not `motion.button`. Playwright's `getByRole('button')` detection requires a real or ARIA button, but `motion.button` has known interaction issues in tests.
- **Context menu ARIA:** Menu container has `role="menu"`; each item has `role="menuitem"`. Playwright selectors use `getByRole('menuitem', { name: /.../ })`.

---

## Design System

| Token | Value | Usage |
|---|---|---|
| Canvas background | `#f0ebe3` | Canvas root div background |
| Near-black | `#0f0d0a` | Text, borders, shadows |
| Red accent | `#dc2626` | Primary buttons, focus rings, highlights |
| Muted text | `#6b6560` | Subtitles, secondary labels |
| Surface | `#ffffff` | Modal and panel backgrounds |
| Font | Bricolage Grotesque | Loaded via Google Fonts in `public/index.html` |
| Border radius | none (`rounded-none`) | All interactive elements |
| Box shadow style | hard offset, no blur | e.g. `8px 8px 0 #0f0d0a`, `4px 4px 0 #dc2626` |

---

## Accessibility Conventions

- All modals: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to the heading `id`
- Context menu: `role="menu"` on wrapper, `role="menuitem"` on each button
- Toolbar toggles: `aria-pressed={boolean}` on Connect and Physics buttons; search filter buttons
- Search match count: `<span className="sr-only" aria-live="polite">{matchCount} nodes matched</span>`
- Focus rings: `:focus-visible { outline: 3px solid #dc2626; outline-offset: 2px; }`
- Hidden from layout but visible to screen readers: `.sr-only` utility class defined in `index.css`
- Nodes: `role="button"`, `tabIndex={0}`, `onKeyDown` handles Enter and Space, `aria-label` describes the node

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

## Import Pipeline

The import wizard (`ImportModal` → `importUtils`) supports:
- Flexible column headers via `HEADER_MAP` (e.g. `Source`, `Participant` → source field)
- Required column: `Code` / `Code (Comment)` — rows without a code value are skipped
- Optional columns: `Source`, `Quoted Text` / `Quote`, `Preliminary Theme` / `Theme`
- Multi-sheet Excel files: active sheet is selected automatically
- Existing theme names are reused; new unique labels create new theme nodes
- Modal is scrollable (`max-h-[90vh] overflow-y-auto`) for large preview tables
- Sample file: `docs/samples/thematic-import-sample.csv`

---

## Running Tests

```bash
npm test                              # Jest unit tests (4 tests, 2 suites)
npm run test:e2e                      # Playwright E2E (13 tests, Chromium)
npx playwright test --reporter=list   # verbose E2E output
```

**Test notes:**
- Every Playwright test clears `localStorage` in `beforeEach`
- Wait 300ms after opening PhysicsPanel before interacting (CSS width transition)
- Status bar selector: `.border-t-2` (not `.border-t.border-slate-700`)
- Context menu item selector: `getByRole('menuitem', { name: /.../ })`

---

## Bugs Fixed (History)

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | High | Export buttons were no-ops — no `id="canvas-export-target"` element | Added `id` to Canvas root div |
| 2 | High | Physics sliders had no effect after simulation init | `useDragAndSimulation` accepts `physicsParams` prop; calls `updateParams()` reactively |
| 3 | Medium | Deleting a theme left codes with stale `primaryThemeId` | `DELETE_NODE` reducer unassigns affected codes and resets their color |
| 4 | High | localStorage race condition on mount — save effect overwrote restored data | Replaced effect-based restore with `useReducer` lazy initializer |
| 5 | Medium | Zoom-to-cluster effect missing `graphState.nodes` dep | Added `graphState.nodes` to the focus-view `useEffect` dep array |
| 6 | Low | Unassigned codes cluster missing `-Math.PI / 2` angle offset | Fixed in `handleAlign()` so unassigned codes start at 12 o'clock like other rings |
| 7 | Low | Modal Escape handler installed even when modal was closed | Added `if (!node) return;` guard in `useEffect` body; added `node` to deps |
| 8 | Medium | ImportModal cut off with no scroll when content exceeded viewport | Added `max-h-[90vh] overflow-y-auto` to modal container div |
| 9 | Low | E2E selectors broke after ARIA role additions | Updated `app.spec.js`: `getByRole('button')` → `getByRole('menuitem')` for menu items; `.border-t.border-slate-700` → `.border-t-2` for status bar |

---

## What This App Is NOT

- Not a clinical assessment or therapy tool
- Not a diagnostic instrument
- Not connected to any patient record system or health data
- Not intended for use with real client or patient information
- Terminology and output are for academic/research purposes only
