# Design: Undo/Redo and Multi-Select

**Date:** 2026-04-19
**Status:** Approved

---

## Feature 1: Undo/Redo

### Approach: History Wrapper Reducer

The existing `graphReducer` stays untouched. A new `historyReducer` wraps it, owning the full history state:

```
{ past: [{nodes,edges}, ...], present: {nodes,edges}, future: [{nodes,edges}, ...] }
```

`GraphProvider` switches to `historyReducer`. The `useGraph()` hook exposes `state.present`. Two new context values are added: `canUndo`, `canRedo`, `undo()`, `redo()`.

### Undoable Actions

| Action | Undoable? | Notes |
|---|---|---|
| `ADD_NODE` | ✅ | |
| `ADD_NODES` | ✅ | Import batch — one snapshot for entire import |
| `DELETE_NODE` | ✅ | |
| `DELETE_NODES` | ✅ | New bulk action — one snapshot |
| `ADD_EDGE` | ✅ | |
| `DELETE_EDGE` | ✅ | |
| `UPDATE_NODE` | ✅ / ❌ | Only if `changes` contains keys other than `x`/`y` |
| `UPDATE_EDGE` | ✅ | |
| `BULK_ASSIGN_THEME` | ✅ | New bulk action — one snapshot |
| `CLEAR` | ✅ | |
| `SET_GRAPH` | ❌ | localStorage restore — not user-initiated |

**Position-only detection:** if `Object.keys(action.changes)` are a subset of `['x', 'y']`, skip history snapshot.

### History Management

- **Cap:** 50 steps. When `past.length > 50`, drop the oldest entry.
- **On undoable dispatch:** push `present` → `past`, set `present` = result of `graphReducer(present, action)`, clear `future`.
- **UNDO:** pop `past` → `present` (old present → `future`).
- **REDO:** pop `future` → `present` (current present → `past`).

### UI

- Two buttons in Toolbar: `⟲ Undo` and `⟳ Redo`
- Disabled styling when `canUndo` / `canRedo` is false
- Keyboard shortcuts wired in `App.js` `useEffect`: `Ctrl+Z` → undo, `Ctrl+Y` / `Ctrl+Shift+Z` → redo

### Persistence

Only `present` (the graph state) is saved to localStorage — history is session-only, resets on reload.

---

## Feature 2: Multi-Select

### Selection State

`selectedNodeIds: Set<string>` lives in `App.js` alongside `focusThemeId`, `connectMode`. It is UI state — not persisted, not undoable.

**Cleared when:** plain-clicking a node, clicking canvas background, entering connect mode, entering focus view.

### Interaction Model

- `Shift+Click` a node → toggles it in/out of `selectedNodeIds`
- Plain click on a node → clears `selectedNodeIds` (existing behaviour unchanged)
- Click canvas background → clears `selectedNodeIds`

### Visual Feedback

Selected nodes receive:
```js
outline: '3px solid #3b82f6'
outlineOffset: '3px'
```
Applied in `GraphNode.js` based on `isSelected` prop. Stacks cleanly with the existing red search-match shadow.

### Context Menu

Right-clicking when `selectedNodeIds.size > 1` shows a **selection context menu** instead of the single-node menu:

- **`Delete X nodes`** — always shown; dispatches `DELETE_NODES { ids }`
- **`Assign to →`** — shown only if selection contains at least one `code` node; lists all `theme` and `subtheme` nodes as targets

Theme/subtheme nodes in the selection are excluded from assignment (only `code` nodes are reassigned).

### Subtheme Context Menu Fix

Right-clicking a **theme node** (single-select) adds a new item: **`+ Add Subtheme`**

This creates a subtheme with:
- `primaryThemeId` pre-set to the right-clicked theme
- Color inherited from the theme
- An edge already drawn between them

This replaces the broken toolbar-button flow where subthemes are created disconnected.

### New Reducer Actions

#### `DELETE_NODES { ids: string[] }`
Atomic batch delete — removes all listed nodes and all edges touching them. Equivalent to calling `DELETE_NODE` for each, but as a single reducer case so undo restores all in one step.

#### `BULK_ASSIGN_THEME { nodeIds: string[], targetId: string }`
`targetId` may be a theme or subtheme node ID.

For each `code` node in `nodeIds`:
1. Resolve `primaryThemeId`: if `targetId` is a subtheme, use `subtheme.primaryThemeId`; if a theme, use `targetId` directly.
2. Look up the resolved theme's color.
3. Set `primaryThemeId` and `color` on the code node.
4. Add an edge from the code to `targetId` (the subtheme or theme directly clicked), skip if edge already exists.

Both actions are undoable (single snapshot each).

---

## Files Affected

| File | Change |
|---|---|
| `src/context/GraphContext.js` | Add `historyReducer`, `DELETE_NODES`, `BULK_ASSIGN_THEME`; expose `canUndo`, `canRedo`, `undo`, `redo` |
| `src/components/Toolbar.js` | Add Undo/Redo buttons |
| `src/App.js` | Ctrl+Z/Y keyboard handler; `selectedNodeIds` state; `handleBulkDelete`, `handleBulkAssign`; pass selection props |
| `src/components/Canvas.js` | Pass `isSelected` prop to GraphNode; Shift+Click handler; background click clears selection |
| `src/components/nodes/GraphNode.js` | `isSelected` prop → blue outline style |
| `src/components/ContextMenu.js` | Selection context menu branch; `+ Add Subtheme` item on theme nodes |
