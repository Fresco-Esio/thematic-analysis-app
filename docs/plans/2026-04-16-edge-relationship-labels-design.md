# Edge Relationship Labels — Design Document

**Date:** 2026-04-16
**Branch:** feature/ui-redesign
**Status:** Approved

---

## Summary

Add the ability to label and type connections (edges) between code nodes and theme nodes, with distinct visual appearances per relationship type. Edges gain a `relationType` and `label` field. A floating panel (Neo-Brutalist style, draggable) opens near the edge midpoint when the user selects "Edit Relationship" from the edge context menu.

---

## Data Shape Changes

### Edge (extended)

```js
// Before
{ id, source, target }

// After
{ id, source, target, relationType: string | null, label: string | null }
```

- `relationType` — one of the 6 preset keys, or `null` for unlabeled
- `label` — display text shown on canvas; auto-populated from preset name, or free-form custom text
- Backward compatible: existing edges with no `relationType`/`label` render exactly as before

### New Reducer Action

```js
UPDATE_EDGE  { id, changes: Partial<Edge> }
```

Added to `graphReducer` in `GraphContext.js`.

---

## Preset Relationship Types

| Key | Display label | Stroke dash pattern | Meaning |
|---|---|---|---|
| `supports` | supports | solid | Code directly evidences the theme |
| `elaborates` | elaborates | `10,5` | Code adds nuance or depth |
| `contradicts` | contradicts | `5,5` | Code creates tension with the theme |
| `exemplifies` | exemplifies | `2,6` | Code is a concrete instance |
| `contextualises` | contextualises | `16,5` | Code provides background framing |
| `questions` | questions | `5,10` | Code raises doubt about theme scope |

Defined in a new `src/utils/edgeTypes.js` constants file.

---

## Visual Design

### Edge strokes

- **Unlabeled edges:** `2px` solid — unchanged from current
- **Labeled edges:** `3.5px` stroke, dash pattern from type map
- **Hover/active:** `5px` stroke (all edges)
- Stroke color: inherited from target theme node color (unchanged)

### Midpoint label

- SVG `<text>` element at `((x1+x2)/2, (y1+y2)/2)`
- Behind it: a `<rect>` with `#f0ebe3` fill, `3px` padding each side
- Font: Bricolage Grotesque, `10px`, `700` weight
- Color: target theme node color
- On hover: thin `#dc2626` underline via `text-decoration`
- Only rendered when `label` is set

---

## Floating Panel — `EdgeRelationshipPanel`

### Positioning

- Appears anchored to the edge midpoint in screen space
- Viewport-aware: shifts left/up if it would overflow viewport edges
- Default offset: `+12px` right, `+12px` down from midpoint

### Anatomy

```
┌──────────────────────────────┐  ← 2px solid #0f0d0a border
│  ···  Relationship  ✕        │  ← 6px grip strip (drag handle) + title + close
├──────────────────────────────┤
│  [supports]  [elaborates]    │  ← preset chips, 2 per row
│  [contradicts] [exemplifies] │
│  [contextualises] [questions]│
├──────────────────────────────┤
│  ___custom label____________ │  ← underline-only input
└──────────────────────────────┘
```

- Width: `220px`
- Background: `#f0ebe3`
- Box shadow: `4px 4px 0 #0f0d0a`
- Draggable via grip strip (pointer events on the strip only)
- Font: Bricolage Grotesque throughout

### Preset chips

- Each chip: type name + a 24×10px SVG line preview using the actual dash pattern at `3.5px` stroke
- Unselected: cream bg, `#0f0d0a` border `1.5px`, near-black text
- Selected: `#0f0d0a` bg, cream text, `2px 2px 0 #dc2626` red shadow
- Hover: `#f0ebe3` → slight darken (`#e8e1d7`)

### Custom input

- Placeholder: `"custom label…"`
- Bottom-border only: `2px solid #0f0d0a`
- Typing clears preset selection; selecting a preset clears custom input
- Apply on Enter or blur

### Dismissal

- Click outside the panel
- Press Escape
- Click `✕` close button

---

## Interaction Flow

1. User right-clicks an edge → context menu appears
2. Context menu shows **"✎ Edit Relationship"** above existing "Delete" item
3. Panel opens anchored near edge midpoint
4. User clicks a preset chip → `relationType` and `label` update immediately (live preview on canvas)
5. Or user types custom label → clears preset, applies on Enter/blur
6. Dismiss panel — edge retains its type/label

---

## Files Changed / Created

| File | Change |
|---|---|
| `src/utils/edgeTypes.js` | New — preset type map, dash pattern constants |
| `src/context/GraphContext.js` | Add `UPDATE_EDGE` action to reducer |
| `src/components/EdgeRelationshipPanel.js` | New — floating panel component |
| `src/components/Canvas.js` | Edge rendering: strokeDasharray, midpoint label; open panel on "Edit Relationship" |
| `src/App.js` | `edgeEditId` state; pass panel open/close handlers to Canvas and ContextMenu |

---

## Out of Scope

- Edge type filtering/search
- Importing/exporting edge relationship data (future)
- Multiple labels per edge
- Directional arrows on edges
