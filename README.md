# Thematic Analysis App

Interactive visual workspace for **Braun & Clarke Reflexive Thematic Analysis** — a qualitative research methodology, not a clinical tool.

This app helps qualitative researchers move from coded data excerpts to a clear thematic map by combining:

- draggable code and theme nodes on a physics-enabled canvas
- visual links between codes and themes
- import from CSV or spreadsheet data
- search, focus, and alignment tools for navigating large maps
- export of the final map to PNG and PDF

> **Research context:** This tool supports the six-phase Braun & Clarke Reflexive Thematic Analysis process (Braun & Clarke, 2006; 2019+). It assists with Phases 3–5: generating initial codes, constructing themes, and producing a thematic map for review. It is not a diagnostic, clinical, or therapeutic instrument.

---

## Why This Exists

Most thematic analysis work starts in tables and ends in static diagrams. This app bridges both stages:

- Start from coded rows in CSV/XLSX
- Automatically generate code and theme nodes with edges
- Reorganize and refine clusters on a live physics canvas
- Export publication-friendly snapshots of your thematic map

---

## Core Features

### Canvas & Navigation
- Pan, zoom, drag, and force-based physics layout
- **⊞ Fit View** — reframes all nodes into the viewport
- **⊹ Align** — radial layout: themes in an outer ring, codes clustered around their theme
- **⊙ Focus View** — dims all nodes outside a chosen theme cluster and zooms the camera to it; Escape to exit

### Nodes
- **Theme nodes** — circular, colored, 160 px; represent thematic categories
- **Code nodes** — circular, white with colored accent, 130 px; hold a label, raw quote, and source reference
- Hover a code node to see its quote in a floating tooltip
- Right-click any node for context menu: rename/edit, focus (themes), delete

### Search
- Expandable search bar in the toolbar
- Filter by Themes, Codes, or both
- Unmatched nodes dim to 25% opacity; matched nodes highlight with a red shadow

### Connections
- **Connect mode** — click a code node then a theme node to create a link; the code adopts the theme's color and `primaryThemeId`
- Edges rendered as SVG lines with arrowheads

### Import
- Accepts `.csv`, `.xlsx`, `.xls`
- Two-step wizard: upload → preview → confirm
- Flexible header matching (see Import Data Format below)
- Multi-sheet Excel files supported; active sheet auto-detected

### Export
- **PNG** — captures the canvas at 2× scale
- **PDF** — same capture with an app name + date footer

### Persistence
- Graph state auto-saved to `localStorage` on every change
- Physics parameters saved separately
- Restored synchronously on page load (no flash of empty canvas)

### Accessibility
- Full keyboard navigation: Tab to focus nodes, Enter/Space to activate, Escape to close modals
- ARIA roles: `dialog`, `menu`, `menuitem`, `aria-pressed`, `aria-live` polite region for search match count
- Visible focus rings (`:focus-visible`, 3 px red outline)
- Screen-reader live region announces search result counts

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 19, Create React App |
| Styling | Tailwind CSS 3 + inline styles for dynamic values |
| Design | Neo-Brutalist — Bricolage Grotesque font, cream canvas `#f0ebe3`, near-black `#0f0d0a`, red accent `#dc2626` |
| State | `useReducer` + React Context |
| Graph layout | D3 v7 force simulation |
| Animation | Framer Motion 12 |
| File import | XLSX + PapaParse |
| Export | html2canvas + jsPDF |
| Unit tests | Jest + @testing-library/react |
| E2E tests | Playwright (Chromium) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Install

```bash
npm install
```

### Run in Development

```bash
npm start
```

Then open http://localhost:3000

---

## Quick Start (2 Minutes)

1. `npm start` — open the app in your browser.
2. Click **⬆ Import** in the top toolbar.
3. Select `docs/samples/thematic-import-sample.csv`.
4. Review the preview and click **Confirm Import**.
5. Click **⊹ Align** to arrange nodes into theme clusters.
6. Toggle **↔ Connect** to draw additional code→theme links.
7. Use **⊙ Focus View** (right-click a theme) to zoom into a cluster.
8. Click **⊞ Fit View** then **↓ PNG** or **↓ PDF** to export.

---

## Available Scripts

```bash
npm start               # dev server on http://localhost:3000
npm test                # Jest unit tests (4 tests, 2 suites)
npm run build           # production bundle → build/
npm run test:e2e        # Playwright E2E (13 tests, Chromium headless)
npx playwright test --reporter=list   # verbose E2E output
```

---

## Import Data Format

The importer accepts `.csv`, `.xlsx`, and `.xls` files (multi-sheet Excel supported).

Expected logical columns (header matching is flexible):

| Logical Field | Accepted Header Variants |
|---|---|
| Code (required) | `Code`, `Code (Comment)` |
| Source | `Source`, `Participant`, `Interview` |
| Quote | `Quoted Text`, `Quote`, `Excerpt` |
| Theme | `Preliminary Theme`, `Theme`, `Category` |

Rows without a code value are skipped. A sample file is included:

```
docs/samples/thematic-import-sample.csv
```

### Import Behaviour

- One code node is created per valid row
- Theme nodes are auto-created from unique theme label values
- Existing matching theme names are reused (no duplicates)
- Codes without a theme arrive as unassigned (gray)

---

## Export Behaviour

- **PNG** — captures `#canvas-export-target` at 2× scale with dark background
- **PDF** — same capture, adds a footer with app name and export date

Use **Fit View** immediately before exporting for the cleanest output.

---

## Project Structure

```
src/
  App.js                        Root composition; all modal/panel open state
  context/
    GraphContext.js             Global reducer + localStorage (lazy initializer)
  components/
    Canvas.js                   D3 simulation, SVG edges, React node layer, pan/zoom
    Toolbar.js                  Toolbar buttons + expandable search bar
    PhysicsPanel.js             Collapsible sidebar with D3 force sliders
    ContextMenu.js              Right-click menu (auto-dismiss, viewport-aware)
    QuoteTooltip.js             Floating tooltip on code node hover
    nodes/
      GraphNode.js              Unified node component (theme + code variants)
    modals/
      ImportModal.js            Two-step import wizard (upload → preview → confirm)
      CodeEditModal.js          Edit code label, quote, source
      ThemeEditModal.js         Edit theme name + color; cascades color to codes
  utils/
    importUtils.js              parseFile(), buildGraphFromRows(), generateTemplate()
    exportUtils.js              exportToPng(), exportToPdf()
    forceSimulation.js          createSimulation() factory; chainable alpha()/restart()
    nodeUtils.js                Node sizing, color helpers
    motionConfig.js             Shared Framer Motion variants
e2e/
  app.spec.js                   13 Playwright E2E tests
docs/
  samples/                      Sample import CSV
  plans/                        Implementation planning notes
```

---

## State and Persistence

Graph state is managed via a reducer in `GraphContext` and persisted to `localStorage` synchronously on every change.

```
localStorage keys:
  thematic_analysis_graph_v1    — full graph state (nodes + edges)
  thematic_analysis_physics_v1  — physics simulation parameters
```

The reducer uses a **lazy initializer** (third argument to `useReducer`) to restore state before first render — no effect-based restore, no flash of empty canvas.

---

## Usage Tips

- **Starting fresh?** Use **Add Theme** and **Add Code** for quick manual mapping.
- **Starting from data?** Use **Import** with your coded transcript spreadsheet.
- **Messy layout?** Click **⊹ Align** to snap nodes into clean theme clusters.
- **Large map?** Right-click a theme and choose **⊙ Focus View** to isolate that cluster.
- **Searching?** Click **⌕ Search**, type a query, and toggle Themes/Codes filters.
- **Physics tweaks?** Open **⚙ Physics** to adjust link distance, charge, and collision radius.
- **Before exporting?** Click **⊞ Fit View** to ensure the full map is in frame.

---

## Troubleshooting

### Import creates fewer nodes than expected
- Check that the `Code` / `Code (Comment)` column has non-empty values.
- Rows without a code label are skipped by design.
- Confirm header names map to the expected fields (see Import Data Format above).

### Imported codes are all gray
- Gray means unassigned — no `Preliminary Theme` value was found.
- Verify theme column values are present and non-empty in your source file.
- Alternatively, use Connect mode to assign codes to themes manually.

### Canvas appears crowded or overlapping
- Click **⊹ Align** to apply the radial layout instantly.
- Open **⚙ Physics** and increase collision radius.
- Click **⊞ Fit View** to reframe all nodes.

### Export output is clipped
- Use **⊞ Fit View** immediately before exporting.
- Avoid zooming in too far before capture.

### My previous session is still loaded
- The app persists graph state in browser `localStorage` across page loads.
- Click **✕ Clear** in the toolbar to reset the canvas.

---

## Documentation

Planning notes and design references:

```
docs/plans/2026-04-16-ui-redesign.md    UI redesign task plan
docs/design-demos/aesthetics-demo.html  Neo-Brutalist design reference
CLAUDE.md                               Project conventions for AI-assisted dev
.github/copilot-instructions.md         Copilot/IDE assistant guidelines
```

---

## Contributing

1. Create a feature branch from `master`
2. Make focused, testable changes
3. Run `npm test` and `npm run test:e2e` locally before pushing
4. Open a pull request with a clear description of behaviour changes

---

## License

No license file is currently included. If you plan to distribute this project, add a `LICENSE` file with your intended terms.
