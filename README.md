# Thematic Analysis App

Interactive visual workspace for **Braun & Clarke Reflexive Thematic Analysis** — a qualitative research methodology, not a clinical tool.

This app helps qualitative researchers move from coded data excerpts to a clear thematic map by combining:

- draggable code and theme nodes
- visual links between codes and themes
- import from spreadsheet or CSV data
- export of the final map to PNG and PDF

> **Research context:** This tool is designed specifically to support the six-phase Braun & Clarke Reflexive Thematic Analysis process (Braun & Clarke, 2006; 2019). It assists with Phases 3–5: generating initial codes, constructing themes, and producing a thematic map for review. It is not a diagnostic, clinical, or therapeutic instrument.

The project is designed to support analysis of qualitative data with thematic mapping for visualization of reflexive thematic analysis.

## Why This Exists

Most thematic analysis work starts in tables and ends in static diagrams. This app bridges both stages:

- Start from coded rows in CSV/XLSX
- Automatically generate code and theme nodes
- Reorganize and connect nodes on a physics-enabled canvas
- Export publication-friendly snapshots of your map

## Core Features

- Graph canvas with pan, zoom, drag, and force-based layout controls
- Two node types:
	- Theme nodes (named categories with color)
	- Code nodes (label, quote, source, optional primary theme)
- Connect mode for creating or removing relationships
- Right-click context menus for edit and delete actions
- Modal editors for code/theme content
- Import pipeline for CSV/XLSX coded excerpts
- Built-in spreadsheet template generator for import-ready data
- Local persistence using browser localStorage
- Export to PNG and PDF via canvas capture

## Tech Stack

- React 19
- Create React App (react-scripts)
- Tailwind CSS
- D3 (force simulation)
- Framer Motion (interaction/animation)
- XLSX + Papa Parse (file import)
- html2canvas + jsPDF (export)

## Getting Started

### Prerequisites

- Node.js 18+ recommended
- npm 9+ recommended

### Install

```bash
npm install
```

### Run in Development

```bash
npm start
```

Then open http://localhost:3000

## Quick Start (2 Minutes)

1. Start the app with npm start.
2. Click Import in the top toolbar.
3. Select the sample file at docs/samples/thematic-import-sample.csv.
4. Confirm import to generate code and theme nodes.
5. Drag nodes to organize clusters.
6. Toggle Connect to map code nodes to themes.
7. Click Fit View and export to PNG or PDF.

Suggested screenshot captures for documentation updates:

- Import modal open with sample selected
- Canvas after import with auto-generated themes
- Final map before export

## Available Scripts

```bash
npm start
```

Runs the app in development mode.

```bash
npm test
```

Runs the test watcher (Jest + Testing Library).

```bash
npm run build
```

Builds an optimized production bundle into the build folder.

```bash
npm run eject
```

Ejects from CRA (one-way operation).

## Import Data Format

The importer accepts .csv, .xlsx, and .xls files.

Expected logical columns (header matching is flexible):

- Source / Participant
- Quoted Text
- Code (Comment)
- Preliminary Theme

Common header variants are also supported (for example: Source, Quote, Code, Theme).

A sample import file is included in this repository:

- docs/samples/thematic-import-sample.csv

### Import Behavior

- One code node is created per valid row
- Rows without a code value are skipped
- Theme nodes are auto-created from unique theme labels
- Existing matching theme names are reused
- Code nodes without a theme remain unassigned (gray)

## Export Behavior

- PNG export captures the current canvas state
- PDF export captures the same view and adds a footer with app name and date

## Project Structure

```text
src/
	components/
		modals/
		nodes/
	context/
		GraphContext.js        # global graph state + persistence
	utils/
		importUtils.js         # CSV/XLSX parsing and graph generation
		exportUtils.js         # PNG/PDF export helpers
		forceSimulation.js     # force layout configuration
	App.js                   # root composition and app-level UI state
```

## State and Persistence

Graph state is managed with a reducer in GraphContext and persisted to localStorage so users can continue where they left off in the same browser.

Storage key:

- thematic_analysis_graph_v1

## Usage Tips

- Use Add Theme and Add Code for quick manual mapping
- Use Import when starting from coded transcript data
- Use Connect mode to assign codes to themes visually
- Open Physics to refine cluster spacing and readability
- Use Fit View before exporting for cleaner output

## Troubleshooting

### Import parses but creates fewer nodes than expected

- Check that the Code or Code (Comment) column has non-empty values.
- Rows without a code label are skipped by design.
- Confirm your header names map to Source, Quoted Text, Code, and Theme fields.

### Imported codes are all gray

- Gray means unassigned.
- Verify Preliminary Theme values are present and non-empty.
- In Connect mode, click a code first, then a theme to assign it.

### Canvas appears crowded or overlapping

- Open Physics and increase collision radius.
- Use Fit View to reframe all nodes on screen.
- Drag key theme nodes apart first, then let simulation settle.

### Export output is clipped or not centered

- Use Fit View immediately before exporting.
- Keep the map inside the visible viewport before capture.
- Re-export after zoom/pan adjustments.

### My previous session is still loaded

- The app persists graph state in browser localStorage.
- Use Clear from the toolbar to reset the canvas.

## Documentation

Planning and implementation notes are stored in:

- docs/plans/

## Contributing

1. Create a feature branch from main
2. Make focused, testable changes
3. Run npm test and npm run build locally
4. Open a pull request with a clear description of behavior changes

## License

No license file is currently included in this repository.
If you plan to distribute this project, add a LICENSE file with your intended terms.
