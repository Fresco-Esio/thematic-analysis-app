# Design: Wall import seeding + Outline view (Sankey replacement)

**Date:** 2026-07-17
**Status:** Draft — awaiting user review
**Scope:** Two independent changes approved in brainstorming:
1. Fix the import → Wall bug (no regions created, so any card move unassigns the code).
2. Replace the Sankey view with a Thematic Map hierarchy ("Outline") plus a theme × source grounding matrix.

---

## Part 1 — Import seeds the Wall

### Problem

`buildGraphFromRows()` (importUtils.js) emits theme/code nodes and edges but no
regions and no `wallPosition`s. Regions are only created by ＋ Add Theme
(App.js) and the one-time v1→v2 migration. Consequences on the Wall:

- Assigned codes render at their physics `x`/`y` fallback (`resolveWallPosition`),
  producing an unsorted heap with no territories.
- On any drop, `assignmentAfterDrop(card, regions=[], themeId)` hits the
  "fully outside all regions" branch and returns `{ unassign: true }` — the
  first move of any imported card silently strips its theme.

### Fix

**New pure helper in `src/utils/wallGeometry.js`:**

```
seedWallLayout(themes, codesByThemeId, existingRegions = [])
  → { regions: Region[], wallPositions: Map<codeId, {x, y}> }
```

- One region per theme that lacks one (id `region-<themeId>` — `ADD_REGION`
  already no-ops on duplicates).
- **Region sizing scales with card count.** Card cell = 192 × 112 (card
  176 × 96 + gutter). Columns ≈ `ceil(sqrt(n * 1.5))` (wider than tall),
  region = cols·192 + 2·24 padding wide, rows·112 + 2·24 + 48 label headroom
  tall, minimum 440 × 320 (matches migration/Add Theme default).
- **Regions pack into rows** left-to-right with an 80 px gutter, wrapping at
  ~2400 px world width; row height = tallest region in the row. No overlap by
  construction (overlapping regions would mark every card contested).
- **Cards grid inside their region**, row-major from the top-left content
  corner (below label headroom), centered positions compatible with
  `cardRect()` containment — every seeded card is *fully inside* exactly one
  region, so `assignmentAfterDrop` keeps its assignment.
- **Themes that already have a region** (re-import into existing project): new
  cards grid into the existing rect, clamped to fit; overflow stacks into
  piles (already handled by `clusterPiles`). The existing region is not moved
  or resized.
- Codes with no theme get **no** `wallPosition` → they land in the UNSORTED
  tray, unchanged.

**Wiring in `ImportModal.handleConfirm()`:**

1. Compute `seedWallLayout` from `result.themeNodes` + assigned
   `result.codeNodes` (+ current `regions` from context for the re-import case).
2. Patch each assigned code node with its seeded `wallPosition` before
   `ADD_NODES`.
3. Also seed `wallPosition` on new theme nodes (mirrors `handleAddTheme`) at
   their region center.
4. Dispatch `ADD_REGION` per new region after `ADD_NODES`.

**Self-heal for stale saved states** (v2 saves that hit this bug before the
fix): on Wall mount, for any theme that has ≥1 assigned code but no region,
seed a default 440 × 320 region centered on the theme's
`wallPosition ?? {x, y}` via the same helper. One `useEffect` in `WallView`,
dispatching `ADD_REGION` (idempotent). These healed regions may overlap for
circle-layout imports — acceptable; the user can drag them apart, and it beats
silently unassigning their coding work.

### Non-goals

- No change to `assignmentAfterDrop` semantics (drop on empty wall =
  unassign stays deliberate).
- No single-undo-step batching of import dispatches (pre-existing behavior).

### Tests

- Unit (wallGeometry.spec): `seedWallLayout` — every card fully inside its
  region (`containment(...).fully`), no region–region overlap, min size
  respected, existing regions untouched, unthemed codes absent from the map.
- Unit (importUtils/ImportModal level if practical): confirm dispatch sequence
  includes regions and patched wallPositions.
- E2E: import sample CSV → switch to Wall → regions visible (one per theme) →
  drag a card a short distance *within* its region → card keeps its color /
  does not appear in UNSORTED tray.

---

## Part 2 — Replace Sankey with the Outline view

### Problem

The Sankey assumes aggregating flows. This data has: one source (left column
is a zero-information fan), unique value-1 codes (ribbon thickness carries no
signal), and 60+ labels in a fixed 16:10 frame (guaranteed collisions). The
one analytic feature (single-source grounding warnings) is inert with one
source.

### Replacement: "Outline" — themes → subthemes → codes hierarchy + grounding matrix

**View key `'outline'`**, toolbar tab **¶→ replaced**: Sankey tab becomes
**Outline**. `SankeyView`, `sankeyTransform`, their tests, and the
`d3-sankey` dependency are deleted in the same change (no dead code).

**New files:**

- `src/utils/outlineTransform.js` — pure, no d3/React:

  ```
  buildOutline(nodes, edges) → {
    themes: [{ theme, subthemes: [{ subtheme, codes: [] }], looseCodes: [],
               codeCount, sourceCounts: Map<label, n> }],
    unassigned: [codes],
    sources: [label],           // distinct, "No source" bucketed last
    warnings: Set<themeId>,     // grounded in a single source (≥2 sources exist)
    isEmpty
  }
  ```

  Subtheme membership reuses the Sankey's rule: first edge from a code to a
  subtheme of the code's own theme. Themes ordered by codeCount desc;
  codes keep import order.

- `src/components/outline/OutlineView.js` — rendered with plain divs
  (no d3): a vertically scrollable document inside the panel.

  - **Theme band** per theme: color header bar (theme color, label, `n codes ·
    m sources` badge, ⚠ single-source warning with the existing title text).
    Band height grows with content — prevalence reads as block size.
  - Inside a band: **subtheme sub-bands** (indented, thinner color rail),
    then loose codes. Codes render as **chips in a wrapped flex grid** —
    compact cards with the code label, not one-per-row lists, so 60+ codes
    stay dense but readable.
  - **Unassigned** gray band at the bottom (only when non-empty).
  - **Interactions** (parity with Sankey affordances): hover code →
    `QuoteTooltip`; click code → `CodeEditModal`; click theme header →
    isolate (other bands collapse to slim headers; Escape or ✕ exits).
  - **Grounding matrix** at the end of the document when `sources.length ≥ 2`:
    rows = themes (same order/colors), columns = sources, cell = code count
    with opacity-scaled fill of the theme color, zero cells blank. With one
    source, a one-line note renders instead: "Grounding matrix appears when
    codes come from two or more sources." (It lights up when the PGY-1/PGY-3
    focus groups are imported.)
  - **Export**: the scrollable document root carries
    `id="canvas-export-target"`; dynamic height (html2canvas captures full
    element height). No fixed 16:10 frame — label collisions become
    structurally impossible.
  - Empty state mirrors the Sankey's (import CTA).

**App.js / Toolbar changes:** `view` union becomes
`'wall' | 'graph' | 'outline' | 'report'`; tab label "Outline"; the
`graphOnly` toolbar-disable behavior is unchanged.

### Styling

Neo-Brutalist conventions as elsewhere: 2px `#0f0d0a` borders, hard shadows,
Bricolage Grotesque, theme palette colors, cream canvas. Tailwind for layout,
inline style for theme-driven colors.

### Tests

- Unit: `outlineTransform.spec` — grouping, subtheme routing, source
  bucketing ("No source"), warnings only when ≥2 sources exist, ordering,
  isEmpty.
- E2E: replace the Sankey specs — Outline tab renders theme bands after
  import; code chip click opens CodeEditModal; theme isolation works; with the
  single-source sample, the matrix note (not the matrix) is shown.
- CLAUDE.md: update Key Files, view union, export-ID convention list, and
  remove Sankey rows after implementation.

### Decided during brainstorming

- Sankey is removed, not kept alongside (user: "does not really serve a
  useful function").
- Tab name "Outline" (avoids colliding with the existing "Graph" view, which
  already plays the network-style thematic-map role). Open to rename.

---

## Implementation order

1. Part 1 (bug fix) — independent, ships first.
2. Part 2 (Outline view) — independent of Part 1.

Each part: red-green tests per project convention, E2E updated, CLAUDE.md
touched where conventions change.
