# Undo/Redo and Multi-Select Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Add session-level undo/redo (Ctrl+Z/Y, Toolbar buttons) and Shift+Click multi-select with bulk delete and bulk theme/subtheme assignment.

**Architecture:** `historyReducer` wraps the existing `graphReducer` inside `GraphContext.js` — no changes to the existing reducer logic. Multi-select lives as `selectedNodeIds: Set<string>` in `App.js` (UI state only). Two new reducer actions (`DELETE_NODES`, `BULK_ASSIGN_THEME`) support atomic bulk operations.

**Tech Stack:** React 19, useReducer + Context, Tailwind CSS 3, existing ContextMenu item-array API.

---

## Task 1: Add `DELETE_NODES` and `BULK_ASSIGN_THEME` to `graphReducer`

**Files:**
- Modify: `src/context/GraphContext.js`

These are pure reducer cases added to the existing `graphReducer` switch. No history logic yet — just new action types.

**Step 1: Add `DELETE_NODES` case**

Inside the `switch` in `graphReducer`, add after `DELETE_NODE`:

```js
case 'DELETE_NODES': {
  const idSet = new Set(action.ids);
  return {
    nodes: state.nodes
      .filter(n => !idSet.has(n.id))
      .map(n => {
        // If a deleted node was this node's primaryThemeId, revert to unassigned
        if (idSet.has(n.primaryThemeId)) {
          return { ...n, primaryThemeId: null, color: UNASSIGNED_COLOR };
        }
        return n;
      }),
    edges: state.edges.filter(e => !idSet.has(e.source) && !idSet.has(e.target)),
  };
}
```

**Step 2: Add `BULK_ASSIGN_THEME` case**

Add after `DELETE_NODES`:

```js
case 'BULK_ASSIGN_THEME': {
  // targetId may be a theme or subtheme node.
  // Codes get primaryThemeId = resolved theme, color = theme color, edge to targetId.
  const targetNode = state.nodes.find(n => n.id === action.targetId);
  if (!targetNode) return state;

  // Resolve the theme: if targetNode is a subtheme, use its primaryThemeId
  const resolvedThemeId = targetNode.type === 'subtheme'
    ? targetNode.primaryThemeId
    : targetNode.id;
  const themeNode = state.nodes.find(n => n.id === resolvedThemeId);
  if (!themeNode) return state;

  const codeIdSet = new Set(action.nodeIds);

  // Update code nodes
  const updatedNodes = state.nodes.map(n => {
    if (n.type !== 'code' || !codeIdSet.has(n.id)) return n;
    return { ...n, primaryThemeId: resolvedThemeId, color: themeNode.color };
  });

  // Add missing edges (code → targetId)
  const existingEdgePairs = new Set(state.edges.map(e => `${e.source}__${e.target}`));
  const newEdges = [];
  for (const codeId of action.nodeIds) {
    const codeNode = state.nodes.find(n => n.id === codeId && n.type === 'code');
    if (!codeNode) continue;
    const key = `${codeId}__${action.targetId}`;
    if (!existingEdgePairs.has(key)) {
      newEdges.push({ id: `edge-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, source: codeId, target: action.targetId });
    }
  }

  return { nodes: updatedNodes, edges: [...state.edges, ...newEdges] };
}
```

**Step 3: Write unit tests for both new actions**

In `src/context/GraphContext.test.js` (create if it doesn't exist), add:

```js
import { graphReducer } from './GraphContext';

const baseState = {
  nodes: [
    { id: 't1', type: 'theme', label: 'Theme 1', color: '#4f46e5', primaryThemeId: null },
    { id: 'c1', type: 'code',  label: 'Code 1',  color: '#6b7280', primaryThemeId: null },
    { id: 'c2', type: 'code',  label: 'Code 2',  color: '#6b7280', primaryThemeId: null },
  ],
  edges: [{ id: 'e1', source: 'c1', target: 't1' }],
};

test('DELETE_NODES removes multiple nodes and touching edges', () => {
  const next = graphReducer(baseState, { type: 'DELETE_NODES', ids: ['c1', 'c2'] });
  expect(next.nodes).toHaveLength(1);
  expect(next.nodes[0].id).toBe('t1');
  expect(next.edges).toHaveLength(0); // e1 touched c1
});

test('DELETE_NODES reverts primaryThemeId if theme is deleted', () => {
  const state = {
    nodes: [
      { id: 't1', type: 'theme', label: 'Theme 1', color: '#4f46e5' },
      { id: 'c1', type: 'code',  label: 'Code 1',  primaryThemeId: 't1', color: '#4f46e5' },
    ],
    edges: [],
  };
  const next = graphReducer(state, { type: 'DELETE_NODES', ids: ['t1'] });
  expect(next.nodes.find(n => n.id === 'c1').primaryThemeId).toBeNull();
});

test('BULK_ASSIGN_THEME assigns codes to a theme and adds edges', () => {
  const next = graphReducer(baseState, {
    type: 'BULK_ASSIGN_THEME',
    nodeIds: ['c1', 'c2'],
    targetId: 't1',
  });
  const c1 = next.nodes.find(n => n.id === 'c1');
  const c2 = next.nodes.find(n => n.id === 'c2');
  expect(c1.primaryThemeId).toBe('t1');
  expect(c2.primaryThemeId).toBe('t1');
  expect(c1.color).toBe('#4f46e5');
  // e1 already existed (c1→t1), so only one new edge for c2
  expect(next.edges).toHaveLength(2);
});

test('BULK_ASSIGN_THEME via subtheme resolves to parent theme', () => {
  const state = {
    nodes: [
      { id: 't1', type: 'theme',    label: 'Theme 1',    color: '#4f46e5', primaryThemeId: null },
      { id: 's1', type: 'subtheme', label: 'Subtheme 1', color: '#4f46e5', primaryThemeId: 't1' },
      { id: 'c1', type: 'code',     label: 'Code 1',     color: '#6b7280', primaryThemeId: null },
    ],
    edges: [],
  };
  const next = graphReducer(state, {
    type: 'BULK_ASSIGN_THEME',
    nodeIds: ['c1'],
    targetId: 's1',
  });
  const c1 = next.nodes.find(n => n.id === 'c1');
  expect(c1.primaryThemeId).toBe('t1'); // resolved to parent theme
  expect(next.edges[0].target).toBe('s1'); // edge goes to the subtheme
});
```

**Step 4: Run tests**

```bash
npm test -- --testPathPattern=GraphContext
```

Expected: 4 new tests pass.

**Step 5: Commit**

```bash
git add src/context/GraphContext.js src/context/GraphContext.test.js
git commit -m "feat: add DELETE_NODES and BULK_ASSIGN_THEME reducer actions"
```

---

## Task 2: Wrap `graphReducer` with `historyReducer`

**Files:**
- Modify: `src/context/GraphContext.js`

**Step 1: Add the undoable-action detection helper**

Above `GraphProvider`, add:

```js
const POSITION_ONLY_KEYS = new Set(['x', 'y']);

function isUndoable(action) {
  if (action.type === 'SET_GRAPH') return false;
  if (action.type === 'UPDATE_NODE') {
    const keys = Object.keys(action.changes || {});
    return keys.some(k => !POSITION_ONLY_KEYS.has(k));
  }
  return true;
}
```

**Step 2: Add `historyReducer`**

Add after `isUndoable`:

```js
const MAX_HISTORY = 50;

function historyReducer(state, action) {
  // state = { past: [], present: {nodes,edges}, future: [] }
  if (action.type === 'UNDO') {
    if (state.past.length === 0) return state;
    const previous = state.past[state.past.length - 1];
    return {
      past:    state.past.slice(0, -1),
      present: previous,
      future:  [state.present, ...state.future],
    };
  }
  if (action.type === 'REDO') {
    if (state.future.length === 0) return state;
    const next = state.future[0];
    return {
      past:    [...state.past, state.present].slice(-MAX_HISTORY),
      present: next,
      future:  state.future.slice(1),
    };
  }

  const nextPresent = graphReducer(state.present, action);
  if (nextPresent === state.present) return state; // no-op

  if (isUndoable(action)) {
    return {
      past:    [...state.past, state.present].slice(-MAX_HISTORY),
      present: nextPresent,
      future:  [],
    };
  }
  return { ...state, present: nextPresent };
}
```

**Step 3: Update `GraphProvider` to use `historyReducer`**

Replace the `useReducer` call and localStorage logic:

```js
export function GraphProvider({ children }) {
  const [state, dispatch] = useReducer(historyReducer, null, () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.nodes && parsed.edges) {
          return { past: [], present: { nodes: parsed.nodes, edges: parsed.edges }, future: [] };
        }
      }
    } catch (e) {
      console.warn('Failed to restore graph from localStorage:', e);
    }
    return { past: [], present: initialState, future: [] };
  });

  // Save only present to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.present));
    } catch (e) {
      console.warn('Failed to save graph to localStorage:', e);
    }
  }, [state.present]);

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

  return (
    <GraphStateContext.Provider value={state.present}>
      <GraphDispatchContext.Provider value={dispatch}>
        <GraphHistoryContext.Provider value={{ canUndo, canRedo, undo, redo }}>
          {children}
        </GraphHistoryContext.Provider>
      </GraphDispatchContext.Provider>
    </GraphStateContext.Provider>
  );
}
```

**Step 4: Add `GraphHistoryContext` and `useGraphHistory` hook**

Add near the other context declarations:

```js
const GraphHistoryContext = createContext(null);

export function useGraphHistory() {
  const ctx = useContext(GraphHistoryContext);
  if (!ctx) throw new Error('useGraphHistory must be used inside <GraphProvider>');
  return ctx;
}
```

Add `useCallback` to the React import at the top.

**Step 5: Run existing tests to verify nothing broke**

```bash
npm test
```

Expected: All existing tests pass. `useGraph()` still returns `{ nodes, edges }` unchanged (it now reads `state.present` which has the same shape).

**Step 6: Commit**

```bash
git add src/context/GraphContext.js
git commit -m "feat: add historyReducer wrapping graphReducer — undo/redo backbone"
```

---

## Task 3: Toolbar Undo/Redo Buttons

**Files:**
- Modify: `src/components/Toolbar.js`
- Modify: `src/App.js`

**Step 1: Add props to Toolbar**

In `Toolbar.js`, add to the destructured props:

```js
export default function Toolbar({
  // ... existing props ...
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}) {
```

**Step 2: Add buttons to Toolbar JSX**

After the first `<div className="w-px ...">` separator (after the Connect button group), add:

```jsx
<TbBtn onClick={onUndo} disabled={!canUndo} aria-label="Undo">⟲ Undo</TbBtn>
<TbBtn onClick={onRedo} disabled={!canRedo} aria-label="Redo">⟳ Redo</TbBtn>
<div className="w-px h-6 bg-white/20 mx-1" />
```

Update `TbBtn` to handle `disabled`:

```js
function TbBtn({ children, onClick, variant = 'secondary', active = false, disabled = false, ...rest }) {
  const base = 'px-4 py-2 font-bold text-base cursor-pointer transition-all border-2';
  const disabledStyle = 'opacity-30 cursor-not-allowed pointer-events-none';
  const styles = { /* existing */ };
  return (
    <button
      className={`${base} ${styles[variant]} ${disabled ? disabledStyle : ''}`}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}
```

**Step 3: Wire in App.js**

In `AppInner`, import `useGraphHistory`:

```js
import { GraphProvider, useGraphDispatch, useGraph, useGraphHistory, makeId, UNASSIGNED_COLOR } from './context/GraphContext';
```

Destructure in `AppInner`:

```js
const { canUndo, canRedo, undo, redo } = useGraphHistory();
```

Pass to Toolbar:

```jsx
<Toolbar
  {/* existing props */}
  canUndo={canUndo}
  canRedo={canRedo}
  onUndo={undo}
  onRedo={redo}
/>
```

**Step 4: Verify buttons appear and disable correctly**

```bash
npm start
```

Open app, verify ⟲ Undo and ⟳ Redo appear greyed out. Add a theme, verify Undo becomes active. Click Undo, verify theme disappears and Redo becomes active.

**Step 5: Commit**

```bash
git add src/components/Toolbar.js src/App.js
git commit -m "feat: add Undo/Redo buttons to Toolbar"
```

---

## Task 4: Keyboard Shortcuts Ctrl+Z / Ctrl+Y

**Files:**
- Modify: `src/App.js`

**Step 1: Add keyboard handler in `AppInner`**

```js
useEffect(() => {
  function handleKeyDown(e) {
    // Don't fire when typing in inputs/textareas
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
      e.preventDefault();
      undo();
    } else if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
      e.preventDefault();
      redo();
    }
  }
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [undo, redo]);
```

**Step 2: Verify shortcuts work**

```bash
npm start
```

Add a theme. Press Ctrl+Z — theme disappears. Press Ctrl+Y — theme reappears.

**Step 3: Commit**

```bash
git add src/App.js
git commit -m "feat: wire Ctrl+Z/Y keyboard shortcuts for undo/redo"
```

---

## Task 5: `selectedNodeIds` State in App.js

**Files:**
- Modify: `src/App.js`

**Step 1: Add `selectedNodeIds` state**

```js
const [selectedNodeIds, setSelectedNodeIds] = useState(new Set());
```

**Step 2: Clear selection when entering exclusive modes**

Wrap `setConnectMode` calls to also clear selection:

```js
function handleToggleConnect() {
  setConnectMode(prev => {
    if (!prev) setSelectedNodeIds(new Set()); // entering connect mode
    return !prev;
  });
}
```

Replace `onToggleConnect={() => setConnectMode(c => !c)}` (or the equivalent) with `onToggleConnect={handleToggleConnect}`.

For focus view, clear on set:

```js
function handleSetFocusTheme(id) {
  setFocusThemeId(id);
  if (id) setSelectedNodeIds(new Set());
}
```

Replace `setFocusThemeId` calls in context menu with `handleSetFocusTheme`.

**Step 3: Add `handleShiftClickNode` handler**

```js
function handleShiftClickNode(nodeId) {
  setSelectedNodeIds(prev => {
    const next = new Set(prev);
    if (next.has(nodeId)) next.delete(nodeId);
    else next.add(nodeId);
    return next;
  });
}
```

**Step 4: Pass to Canvas**

```jsx
<Canvas
  {/* existing props */}
  selectedNodeIds={selectedNodeIds}
  onShiftClickNode={handleShiftClickNode}
  onClearSelection={() => setSelectedNodeIds(new Set())}
/>
```

**Step 5: Commit**

```bash
git add src/App.js
git commit -m "feat: add selectedNodeIds state and shift-click handler in App.js"
```

---

## Task 6: Shift+Click and `isMultiSelected` in Canvas + GraphNode

**Files:**
- Modify: `src/components/Canvas.js`
- Modify: `src/components/nodes/GraphNode.js`

**Step 1: Add props to Canvas**

In `Canvas.js`, add to the Canvas component props:

```js
export default function Canvas({
  // existing...
  selectedNodeIds = new Set(),
  onShiftClickNode = () => {},
  onClearSelection = () => {},
}) {
```

**Step 2: Thread `isMultiSelected` into GraphNode render**

Find where `GraphNode` is rendered in Canvas and add:

```jsx
<GraphNode
  {/* existing props */}
  isMultiSelected={selectedNodeIds.has(node.id)}
/>
```

**Step 3: Handle Shift+Click in Canvas node click handler**

Find the existing `onClick` handler passed to GraphNode (or where the click event is dispatched). Modify to intercept shift-click:

```js
onClick={(e) => {
  if (e.shiftKey) {
    e.stopPropagation();
    onShiftClickNode(node.id);
    return;
  }
  // existing single-click logic
  onClearSelection();
  // ... rest of existing handler
}}
```

**Step 4: Handle background click to clear selection**

Find the SVG/canvas background click handler and add `onClearSelection()` call:

```js
// On the root SVG or canvas div onClick:
onClick={(e) => {
  if (e.target === e.currentTarget) {
    onClearSelection();
    // existing handler
  }
}}
```

**Step 5: Add `isMultiSelected` prop to `GraphNode.js`**

Add to the props destructuring:

```js
isMultiSelected = false,
```

Update `getBoxShadow()` — add before the `isConnecting` check:

```js
if (isMultiSelected) {
  return `0 0 0 3px #3b82f6, 4px 4px 0 #0f0d0a`;
}
```

Update `variants.visible` to scale slightly when multi-selected:

```js
visible: { scale: (isSelected || isMultiSelected) ? 1.04 : 1, opacity, transition: springs.entrance },
```

**Step 6: Verify visually**

```bash
npm start
```

Shift+click two nodes — both get blue ring. Click canvas background — rings disappear.

**Step 7: Commit**

```bash
git add src/components/Canvas.js src/components/nodes/GraphNode.js
git commit -m "feat: shift+click multi-select with blue outline on selected nodes"
```

---

## Task 7: Selection Context Menu (Bulk Delete + Bulk Assign)

**Files:**
- Modify: `src/App.js`

**Step 1: Add `handleBulkDelete`**

```js
function handleBulkDelete() {
  const ids = [...selectedNodeIds];
  if (!window.confirm(`Delete ${ids.length} selected nodes?`)) return;
  dispatch({ type: 'DELETE_NODES', ids });
  setSelectedNodeIds(new Set());
}
```

**Step 2: Add `handleBulkAssign`**

```js
function handleBulkAssign(targetId) {
  const codeIds = [...selectedNodeIds].filter(id => {
    const n = nodes.find(n => n.id === id);
    return n?.type === 'code';
  });
  if (codeIds.length === 0) return;
  dispatch({ type: 'BULK_ASSIGN_THEME', nodeIds: codeIds, targetId });
  setSelectedNodeIds(new Set());
}
```

**Step 3: Update `handleContextMenu` to show selection menu**

At the top of `handleContextMenu`, add a branch for multi-select:

```js
function handleContextMenu(type, id, x, y) {
  // Multi-select context menu: show when ≥2 nodes selected and right-clicked node is in selection
  if (selectedNodeIds.size > 1 && selectedNodeIds.has(id)) {
    const selCount = selectedNodeIds.size;
    const hasCode = [...selectedNodeIds].some(nid => nodes.find(n => n.id === nid)?.type === 'code');
    const assignTargets = nodes.filter(n => n.type === 'theme' || n.type === 'subtheme');

    const items = [
      { label: `✕ Delete ${selCount} nodes`, action: handleBulkDelete, danger: true },
    ];

    if (hasCode) {
      assignTargets.forEach(target => {
        const prefix = target.type === 'subtheme' ? '  ↳' : '◈';
        items.push({
          label: `${prefix} Assign to: ${target.label}`,
          action: () => handleBulkAssign(target.id),
        });
      });
    }

    setCtxMenu({ visible: true, x, y, items });
    return; // skip single-node menu
  }

  // ... existing single-node logic unchanged below
```

**Step 4: Verify**

```bash
npm start
```

Shift+click 3 codes. Right-click one → selection menu appears with Delete count and assign options. Click "Assign to: Theme 1" → all 3 codes turn theme color. Ctrl+Z → all revert.

**Step 5: Commit**

```bash
git add src/App.js
git commit -m "feat: selection context menu with bulk delete and bulk assign"
```

---

## Task 8: Full E2E Test Pass

**Step 1: Run all E2E tests**

```bash
npx playwright test --reporter=list
```

Expected: All existing tests pass. Fix any failures before proceeding.

**Step 2: Run unit tests**

```bash
npm test
```

Expected: All tests pass.

**Step 3: Manual smoke-test checklist**

- [ ] Add theme → Ctrl+Z removes it → Ctrl+Y restores it
- [ ] Delete code → Undo restores it
- [ ] Import CSV → Undo clears the import
- [ ] ⟲ Undo button disabled on fresh load; enables after first action
- [ ] ⟳ Redo button disabled until something is undone
- [ ] Drag node position is NOT added to undo history (drag → undo → node stays, previous non-position action undone)
- [ ] Shift+click selects multiple nodes with blue ring
- [ ] Click canvas background clears selection
- [ ] Entering Connect mode clears selection
- [ ] Entering Focus View clears selection
- [ ] Right-click on selected group shows "Delete X nodes"
- [ ] "Assign to" submenu lists all themes and subthemes
- [ ] Assigning codes sets correct color and `primaryThemeId`
- [ ] Assigning via subtheme resolves `primaryThemeId` to parent theme
- [ ] Bulk delete with undo restores all nodes

**Step 4: Commit if any fixes were needed**

```bash
git add -p
git commit -m "fix: e2e smoke-test corrections for undo/redo and multi-select"
```
