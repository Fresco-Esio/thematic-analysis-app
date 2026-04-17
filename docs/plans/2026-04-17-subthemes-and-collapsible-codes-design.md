# Design: Subtheme Nodes + Collapsible Code Nodes

**Date:** 2026-04-17  
**Status:** Approved

---

## Overview

Two related features that deepen the hierarchy of the thematic map:

1. **Subtheme nodes** — a new `type: 'subtheme'` node sitting between themes and codes, rendered as a rounded rectangle.
2. **Collapsible code nodes** — codes can be collapsed into their parent node (subtheme or theme) via the context menu, with motion-designed transitions.

---

## Feature 1: Subtheme Nodes

### Data Model

```js
{ id, type: 'subtheme', label, primaryThemeId, color, x, y }
```

- `primaryThemeId` — ID of the connected parent theme; `null` when unassigned.
- `color` — inherited from parent theme's color; falls back to `UNASSIGNED_COLOR` (`#6b7280`) when unassigned.
- No `quote` or `source` fields.

**Reducer changes (`GraphContext.js`):**
- `DELETE_NODE`: deleting a theme resets `primaryThemeId`/`color` on any subtheme referencing it (same pattern as codes).
- `ADD_EDGE`: connecting a subtheme to a theme sets `primaryThemeId` + `color` on the subtheme if not yet assigned (same logic as codes).

No new localStorage key — subthemes live in the existing `thematic_analysis_graph_v1` blob.

### Visual Rendering (`GraphNode.js`)

- **Shape:** `border-radius: 12px` rounded rectangle (not `50%`)
- **Size:** Width scales with label length via `getNodeSize` utility; min `120px`, max `220px`; height auto (wraps to label)
- **Background:** Parent theme's `color` (like theme nodes)
- **Border:** `3px solid #0f0d0a`
- **Box shadow:** `6px 6px 0 ${color}88` (Neo-Brutalist hard shadow)
- **Label:** white text, `font-weight: 700`, centered
- **No badge**
- **`data-node-type`:** `"subtheme"`

States follow existing patterns: selected glow, connecting pulse, search match red shadow, focus dim at `0.2` opacity.

### Creation

**Toolbar:** "Add Subtheme" button near "Add Theme". Creates node at canvas center with `primaryThemeId: null`, `color: UNASSIGNED_COLOR`.

**Context menu on theme nodes:** "Add Subtheme" item dispatches `ADD_NODE` then `ADD_EDGE`, pre-linking to the theme so color is inherited immediately.

**Edit modal (`SubthemeEditModal.js`):** Label field only. Escape closes. `role="dialog"`. Triggered via context menu "Rename" and double-click.

### Focus View

`focusedNodeIds` expands via a two-hop traversal:
1. The focused theme node
2. All subthemes directly connected to that theme
3. All codes connected to that theme **or** any of those subthemes

Update the `focusedNodeIds` `useMemo` in `App.js` accordingly.

### Search

Subthemes match on `label` only — already handled by the generic label-based `matchedNodeIds` memo.

### Alignment (`handleAlign`)

Subthemes join the radial layout on a ring between their parent theme and its codes. Unassigned subthemes cluster with unassigned nodes.

---

## Feature 2: Collapsible Code Nodes

### Behavior

| Code connected to | Collapsed state |
|---|---|
| Subtheme | Fully retracts into subtheme node (hidden); subtheme shows count badge |
| Theme directly | Collapses to small dot near theme; no label, still visible |

Collapse/expand is triggered via **context menu** on the parent node (subtheme or theme): "Collapse Codes" / "Expand Codes".

### State

Ephemeral — lives in `App.js` component state, not persisted to localStorage. Resets on page reload (graph always opens fully expanded).

```js
// App.js
const [collapsedNodeIds, setCollapsedNodeIds] = useState(new Set());
// collapsedNodeIds = Set of subtheme/theme node IDs whose codes are collapsed
```

### Motion Design

All transitions use Framer Motion with physics-based springs.

**Collapsing into subtheme (codes → hidden):**
- Codes animate `scale: 1 → 0`, `opacity: 1 → 0` while translating toward the subtheme's position
- Subtheme count badge fades in (`opacity: 0 → 1`, `scale: 0.8 → 1`) after codes finish animating
- Duration: ~300ms, `spring` easing

**Expanding from subtheme:**
- Reverse: badge fades out, codes animate outward from subtheme position back to their D3 positions

**Collapsing to dot near theme (direct codes):**
- Code node animates to `width/height: 12px`, `border-radius: 50%`, `opacity: 0.6`, label fades out
- Dot position stays near the theme node (D3 position unchanged)
- Expand: reverses back to full size with label fade-in

### Count Badge on Subtheme

When collapsed, a small badge appears on the subtheme node showing the number of hidden codes (e.g. `3`). Styled as a white circle with theme-colored text, positioned top-right of the rounded rectangle.

### Edge Rendering

Edges to collapsed codes are hidden (`opacity: 0`, not removed from state) to avoid visual clutter. Edges restore on expand.

---

## Files Affected

| File | Change |
|---|---|
| `src/context/GraphContext.js` | Add subtheme to `DELETE_NODE` + `ADD_EDGE` logic |
| `src/utils/nodeUtils.js` | Add subtheme sizing constants |
| `src/components/nodes/GraphNode.js` | Add `isSubtheme` branch (rounded rect, sizing, badge) |
| `src/components/modals/SubthemeEditModal.js` | New modal (label only) |
| `src/components/Toolbar.js` | Add "Add Subtheme" button |
| `src/components/ContextMenu.js` | Add "Add Subtheme" (on themes) + "Collapse/Expand Codes" (on themes + subthemes) |
| `src/App.js` | `collapsedNodeIds` state; focus view two-hop traversal; wire SubthemeEditModal |
| `src/components/Canvas.js` | Pass `collapsedNodeIds` to node/edge rendering; hide edges to collapsed codes |
| `e2e/app.spec.js` | New E2E tests for subtheme creation, edit, collapse/expand |
