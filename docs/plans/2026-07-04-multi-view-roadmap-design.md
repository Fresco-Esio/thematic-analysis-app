# Multi-View Roadmap: Wall · Sankey · Report

**Date:** 2026-07-04
**Status:** Approved (brainstorming session)
**Tasks:** #1 (architecture), #2 (Wall), #3 (Sankey), #4 (Report)

## Summary

Extend ThematicMap from a single force-graph canvas into three projections of the same graph state, serving the full arc of reflexive thematic analysis: a **Research Wall** workbench for active analysis, a **Sankey of Evidence** lens for reader-grade figures, and a **Living Report** that turns the map into the written findings (Braun & Clarke phase 6). Same data model — codes, subthemes, themes, quotes, sources, typed edges — new visuals only.

## 1. Architecture & Phasing

- One app, one `GraphContext`, three new views. A toolbar view switcher (Wall · Graph · Sankey · Report) swaps the center panel. Toolbar actions that don't apply to a view disable rather than disappear.
- **The current force canvas survives as "Graph" view.** Wall arrives alongside it as the new default workbench; zero regression risk (existing 21 e2e tests keep passing against Graph). Retiring Graph is a later, evidence-based decision.
- **Additive data model, versioned storage.** New fields only:
  - `node.wallPosition {x, y}` — authored position, separate from physics `x/y`
  - `regions[]` — Wall's theme areas `{id, themeId, rect}`
  - `report` — ordered per-theme prose sections (phase 3)
- localStorage bumps to `thematic_analysis_graph_v2` with a one-time migration reading v1 and seeding `wallPosition` from current physics positions. Failed migration falls back to read-only v1 with a banner — never destroys data.
- Phases ship independently: 1) Wall + view infrastructure, 2) Sankey, 3) Report.

## 2. Research Wall (Phase 1)

Physics off; position is authored and never disturbed.

- **Cards (codes):** index-card styling — label, first quote line in italic, source tag. Cards stack into piles (fanned corners + count badge) for "belongs together, unnamed yet."
- **Regions (themes):** labeled rectangles, tinted fill + solid 3px border in theme color. Dragging a card fully inside sets `primaryThemeId`; dragging out unassigns — **assignment is placement**. A card overlapping two regions keeps its assignment but shows a "contested" corner mark: ambiguity as a first-class state. Subthemes are optional sub-regions nested one level.
- **String (edges):** typed edges render as slightly sagging quadratic curves. Existing relationship panel unchanged.
- **The margin:** fixed left strip holding unassigned cards in a loose grid; imports land here instead of scattering.
- **Reuse:** context menus, modals, search dimming, multi-select, undo all apply unchanged.
- **Export:** whole wall, or one framed region as a per-theme figure.
- **Keyboard:** focused card moves with arrows (8px; Shift = 1px).

## 3. Sankey of Evidence (Phase 2)

Read-mostly lens on `d3-sankey`: **sources → codes → themes** (optional subtheme column toggle).

- Ribbon thickness aggregates code counts per path (scales to multi-quote codes later).
- Unassigned codes flow into an explicit "Unassigned" sink.
- Hover highlights the full path; clicking a theme isolates its flow; clicking a code opens CodeEditModal (the only edit affordance).
- **Grounding warning:** a theme fed by a single source gets a warning glyph — the "one loud interview" detector.
- Quote tooltip reused. Export via existing PNG/PDF pipeline at a fixed figure-friendly aspect ratio. Empty state (no sources) shows guidance.

## 4. Living Report (Phase 3)

`report` = ordered sections `{themeId, proseBlocks[], pullQuoteIds[]}` in v2 storage, referencing node ids (renames flow through; deleted codes degrade to tombstone notes).

- **Edit mode:** document editor; each theme auto-seeds a chapter (color header, name, codes in a side tray). Plain prose blocks — bold/italic only, no rich-text engine. Quotes drag from tray into margin slots.
- **Present mode:** full-screen scroll with a fixed mini-map (small static wall render) highlighting the current theme's region as its chapter scrolls past. Pull-quotes animate via existing `motionConfig`.
- **Export:** print stylesheet → browser PDF (text-selectable); html2canvas only for the mini-map snapshot.

## 5. Cross-Cutting

- **Error handling:** migration fallback banner; Sankey empty-state guidance; report tolerates dangling references.
- **Testing:** unit — migration round-trip, region-assignment reducer, sankey transform, report reference integrity. E2E — view switching, wall drag-assign, contested state, sankey smoke, report edit/present toggle. Existing 21 e2e tests stay green.
- **Design language:** existing tokens throughout. Wall stays flat cream (no skeuomorphic cork). Sankey ribbons use the theme palette at ~80% opacity. Report body: Bricolage, 17px/1.6, 68ch measure.
- **Accessibility:** keyboard card movement; aria-labels on sankey paths; report is native document flow.
- **Out of scope (YAGNI):** collaboration, comments, snapshots/versioning, in-app transcript coding, Metro map (stretch lens to revisit after phase 2).
