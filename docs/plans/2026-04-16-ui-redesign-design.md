# UI Redesign & Feature Additions — Design Document
**Date:** 2026-04-16
**Branch:** `feature/ui-redesign`

---

## Overview

A comprehensive redesign and feature addition pass for the Thematic Analysis app. Changes span visual design (Neo-Brutalist aesthetic), interaction design (microinteractions, animations), node behavior (dynamic sizing), import flow (multi-sheet Excel), and three new features (search, alignment, focus view).

---

## Section 1 — Dynamic Node Sizing

### Goal
Theme and code nodes resize based on their label length. No text is ever truncated. Minimum font size is 16px.

### Architecture
- **New file:** `src/utils/nodeUtils.js` — single source of truth for sizing logic
- **New file:** `src/utils/motionConfig.js` — spring and easing constants

### Sizing formula

```js
// nodeUtils.js
export function getNodeSize(node) {
  const charCount = (node.label || '').length;

  if (node.type === 'theme') {
    const fontSize = Math.max(16, Math.min(26, 16 + Math.floor(charCount / 6)));
    const diameter = Math.max(120, fontSize * charCount * 0.55 + 48);
    return { diameter, fontSize };
  } else {
    const fontSize = Math.max(16, Math.min(22, 16 + Math.floor(charCount / 8)));
    const diameter = Math.max(100, fontSize * charCount * 0.52 + 40);
    return { diameter, fontSize };
  }
}

export function getNodeRadius(node) {
  return getNodeSize(node).diameter / 2;
}
```

### Motion constants

```js
// motionConfig.js
export const springs = {
  entrance: { type: 'spring', stiffness: 220, damping: 22 },
  hover:    { type: 'spring', stiffness: 380, damping: 28 },
};
export const easings = {
  standard: [0.4, 0, 0.2, 1],  // cubic-bezier — symmetric ease-in-out
};
```

### Canvas.js change
Replace `THEME_NODE_SIZE` / `CODE_NODE_SIZE` constants in the fitToView bounding box calculation with `getNodeRadius(node)` called per-node. This is the only change to Canvas.js for sizing.

---

## Section 2 — Planet/Satellite Visual Metaphor + Microinteractions

### Visual differentiation
Theme nodes (planets) vs code nodes (satellites) are distinguished visually, not through physics constraints. The D3 link force naturally clusters connected nodes.

| Property | Theme node (planet) | Code node (satellite) |
|---|---|---|
| Size | Larger (from dynamic sizing) | Smaller |
| Border | 3px solid accent color | 2px solid |
| Shadow | `8px 8px 0 <themeColor>` | `4px 4px 0 rgba(0,0,0,0.4)` |
| Glow on hover | Stronger (12px spread) | Lighter (6px spread) |

### Unified GraphNode component
Replace `ThemeNode.js` and `CodeNode.js` with a single `src/components/nodes/GraphNode.js` that:
- Accepts `node` prop; reads type internally
- Uses `getNodeSize(node)` for dimensions
- Uses Framer Motion `motion.div` for entrance/hover
- Renders appropriate visual weight based on type

### Microinteractions

| Interaction | Animation |
|---|---|
| Node entrance | `scale: 0 → 1` + `opacity: 0 → 1`, spring entrance, staggered by index |
| Node hover | `scale: 1 → 1.05`, spring hover |
| Node drag start | `scale: 1.08`, `cursor: grabbing` |
| Connect mode active | Pulsing ring on all theme nodes (CSS keyframe, 2s loop) |
| Edge creation | Edge fades in over 300ms |
| Node delete | `scale: 1 → 0` + `opacity: 1 → 0`, 200ms |

---

## Section 3 — Tooltip Animation

### Current behavior
`if (!visible) return null` — instant mount/unmount, no animation.

### New behavior
Wrap in `AnimatePresence`. On enter: `opacity: 0→1` + `translateY: 6px→0` over 200ms. On exit: `opacity: 1→0` + `translateY: 0→4px` over 150ms. Both use `cubic-bezier(0.4, 0, 0.2, 1)`.

### Tooltip styling updates
- Minimum font size: 16px
- Left accent bar in theme color (or slate if unassigned)
- Backdrop blur retained

---

## Section 4 — Multi-Sheet Excel Import

### Problem
`importUtils.js` line: `const sheetName = workbook.SheetNames[0]` — always reads the first sheet.

### Solution
Add a sheet-selector step to the import wizard (step 1.5 — between upload and preview).

**New wizard flow:**
1. Upload (drag/drop or click)
2. **Sheet selector** — only shown if workbook has >1 sheet; auto-skipped for CSV and single-sheet .xlsx
3. Preview & Confirm

**`parseXlsx` signature change:**
```js
// Before
async function parseXlsx(file)

// After
async function parseXlsx(file, sheetName = null)
// sheetName defaults to SheetNames[0] if null
```

**ImportModal state additions:**
```js
const [sheetNames, setSheetNames] = useState([]);
const [selectedSheet, setSelectedSheet] = useState('');
```

After file is uploaded in step 1, the workbook is read to extract `SheetNames`. If length > 1, user is shown step 2 (sheet selector). Otherwise proceeds directly to step 3.

---

## Section 5 — Search Bar

### Placement
Toolbar button that expands inline when clicked (progressive disclosure). Collapses back on Escape or blur with no query.

### Behavior
- Text input with live filtering (no submit needed)
- Two filter toggles: `[THEMES]` `[CODES]` — both active by default
- Live result count: `3 of 12 nodes`
- **Matched nodes:** red offset shadow `4px 4px 0 #dc2626`, full opacity
- **Unmatched nodes:** dimmed to 25% opacity
- Empty query = all nodes at full opacity (inactive state)

### State in App.js
```js
const [searchQuery,   setSearchQuery]   = useState('');
const [searchFilters, setSearchFilters] = useState({ themes: true, codes: true });
const [searchOpen,    setSearchOpen]    = useState(false);
```

### Accessibility
- `role="search"` on the search container
- `aria-live="polite"` on the result count
- `aria-label="Search nodes"` on the input
- `aria-pressed` on filter toggles

---

## Section 6 — Alignment Button

### Goal
One-click arrangement that organizes the canvas into a coherent planet/satellite layout.

### Algorithm: Radial-then-settle hybrid

1. **Snap phase** (instant, no animation):
   - Count themes; space them evenly on a ring around canvas center (radius = `Math.max(300, themeCount * 80)`)
   - For each theme, place its connected code nodes on a smaller ring around the theme (radius = `themeRadius + 100 + codeCount * 15`)
   - Unassigned code nodes: placed at canvas center in a small cluster
   - All positions written directly to node data via `UPDATE_NODE` dispatches

2. **Settle phase** (automatic):
   - After positions are written, the D3 force simulation runs normally from those positions
   - The simulation's natural forces refine the layout organically
   - `simulation.alpha(0.5)` to give it enough energy to settle without starting from scratch

### Toolbar integration
New button: `⊹ Align` — calls `handleAlign()` in App.js, which computes positions and dispatches `UPDATE_NODE` for all nodes.

---

## Section 7 — Focus View

### Goal
Allow a researcher to visually isolate a single theme and its connected code nodes.

### Trigger
Right-click context menu on a theme node: "Focus View" item. Also: a focus icon that appears on hover over a theme node.

### Behavior when activated
1. **Camera frames the cluster** — `fitToView` runs scoped to only the focused theme + its code nodes, with 80px padding. Transition: 600ms spring.
2. **Everything outside dims** — all nodes/edges not in the cluster animate to 20% opacity over 200ms (`cubic-bezier(0.4, 0, 0.2, 1)`).
3. **Focus halo** — focused theme node gets a 3px ring in its own color.

### Exiting focus view
- Press **Escape**
- Click the "Exit Focus" pill (bottom-center of canvas, always visible during focus)
- Click any non-focused node

### State in App.js
```js
const [focusThemeId, setFocusThemeId] = useState(null);
```

Canvas receives `focusThemeId` as a prop and applies opacity mask. No new reducer actions needed.

---

## Section 8 — Neo-Brutalist UI Redesign

### Design tokens

```css
--bg-canvas:    #f0ebe3;   /* warm cream */
--bg-toolbar:   #0f0d0a;   /* near-black */
--bg-modal:     #ffffff;
--text-primary: #0f0d0a;
--text-muted:   #6b6560;
--accent:       #dc2626;   /* red */
--accent-light: #fef2f2;
--border:       #0f0d0a;
--shadow-hard:  6px 6px 0 #dc2626;
--shadow-dark:  6px 6px 0 #0f0d0a;
```

### Typography
- **Display / UI labels:** Bricolage Grotesque (Google Fonts) — loaded via `<link>` in `public/index.html`
- **Body / quotes:** system-ui fallback chain
- Minimum font size: 16px throughout

### Component redesign targets

| Component | Change |
|---|---|
| Toolbar | Black bg, white text, red accent buttons, Bricolage Grotesque, hard shadows |
| Canvas background | `#f0ebe3` cream |
| Theme nodes | White fill, black border 3px, theme-color hard shadow |
| Code nodes | White fill, black border 2px, black hard shadow (4px) |
| Modals | White bg, black border, red accent, no blur overlay |
| Status bar | Black bg, white text |
| Context menu | White bg, black border, hard shadow |
| Tooltip | White bg, black border, left accent bar in theme color |
| PhysicsPanel | White bg, black border |

### No gradients, no border-radius on containers
Modals and panels: `border-radius: 0`. Node circles retain `border-radius: 50%`.

---

## Section 9 — Accessibility

All interactive elements meet WCAG 2.1 AA. Specific requirements:

- `<button>` elements for all interactive nodes (not `<div>`)
- `aria-label` on every node: `"[label] — [type] node"`
- `aria-pressed` on all toggle buttons (connect mode, filter toggles, physics toggle)
- `role="search"` + `aria-live="polite"` on search container
- `aria-modal="true"` + `aria-labelledby` on all modals; focus trap inside modals
- `aria-label="Close"` on all close/cancel buttons
- Explicit focus rings: `3px solid #dc2626` with `outline-offset: 2px` (no `outline: none`)
- Color contrast: all text ≥ 4.5:1 against background
- Keyboard navigation: Tab through toolbar, Escape closes modals/menus, Enter/Space activates buttons

---

## Implementation Order

Each chunk gets a code review before the next begins.

1. `nodeUtils.js` + `motionConfig.js` (foundation utilities)
2. `GraphNode.js` (unified node component replacing ThemeNode + CodeNode)
3. `Canvas.js` — swap fixed size constants for `getNodeRadius(node)`
4. `QuoteTooltip.js` — AnimatePresence fade animation
5. `importUtils.js` + `ImportModal.js` — multi-sheet Excel support
6. Search bar — App.js state + Toolbar expansion + Canvas opacity mask
7. Alignment button — radial-then-settle algorithm
8. Focus view — App.js state + Canvas opacity mask + camera
9. Neo-Brutalist redesign — Toolbar, Canvas, modals, status bar, nodes
10. Accessibility pass — semantic HTML, ARIA, focus rings throughout

---

## Branch

All work on branch: `feature/ui-redesign`
