# Subtheme Nodes + Collapsible Code Nodes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Add a third `subtheme` node type (rounded rectangle, inherits parent theme color) and make code nodes collapsible via the context menu, with motion-designed transitions.

**Architecture:** Extend `GraphNode` with an `isSubtheme` branch for rendering; add `subtheme` handling to the reducer's `DELETE_NODE` and `ADD_EDGE` cases; keep collapse state ephemeral in `App.js` (`collapsedNodeIds` Set). All motion via Framer Motion springs already in the project.

**Tech Stack:** React 19, Framer Motion 12, D3 v7, Tailwind CSS 3, Jest + Playwright

---

## Task 1: Extend `nodeUtils.js` with subtheme sizing

**Files:**
- Modify: `src/utils/nodeUtils.js`

**Step 1: Add subtheme sizing constants and branch**

In `src/utils/nodeUtils.js`, add a `subtheme` branch to `getNodeSize`:

```js
const MAX_SUBTHEME_WIDTH = 220;
const MIN_SUBTHEME_WIDTH = 120;

// Inside getNodeSize(), add before the closing else:
  } else if (node.type === 'subtheme') {
    const charCount = (node.label || '').length;
    const fontSize = Math.max(12, Math.min(18, 17 - Math.floor(charCount / 12)));
    const width = Math.min(MAX_SUBTHEME_WIDTH, Math.max(MIN_SUBTHEME_WIDTH, Math.round(80 + charCount * 5)));
    // Return width instead of diameter for subtheme — consumers check node.type
    return { width, fontSize, diameter: width };
  } else {
```

**Step 2: Run existing unit tests to confirm no regression**

```bash
npm test -- --watchAll=false
```
Expected: all tests pass.

**Step 3: Commit**

```bash
git add src/utils/nodeUtils.js
git commit -m "feat: add subtheme sizing to nodeUtils"
```

---

## Task 2: Extend the reducer for subtheme nodes

**Files:**
- Modify: `src/context/GraphContext.js`

**Step 1: Update the comment block at top of file**

Add `"subtheme"` to the NODE TYPES doc comment:
```js
// "subtheme" — { id, type:"subtheme", label, primaryThemeId, color, x, y }
```

**Step 2: Update `DELETE_NODE` to reset subthemes**

In the `DELETE_NODE` case, the `.map()` that resets codes should also reset subthemes:

```js
.map(n => {
  if (isThemeNode && (n.type === 'code' || n.type === 'subtheme') && n.primaryThemeId === action.id) {
    return { ...n, primaryThemeId: null, color: UNASSIGNED_COLOR };
  }
  return n;
})
```

**Step 3: Update `ADD_EDGE` to inherit color for subthemes**

The existing `ADD_EDGE` logic sets `primaryThemeId` only if `codeNode` has none. Extend the condition to also apply when the source is a subtheme node:

```js
const sourceNode = state.nodes.find(n => n.id === action.edge.source);
const themeNode  = state.nodes.find(n => n.id === action.edge.target);
let updatedNodes = state.nodes;

if (sourceNode && themeNode && themeNode.type === 'theme' && !sourceNode.primaryThemeId) {
  updatedNodes = state.nodes.map(n =>
    n.id === sourceNode.id
      ? { ...n, primaryThemeId: themeNode.id, color: themeNode.color }
      : n
  );
}
```

(Replace the existing `codeNode`/`themeNode` block with the above.)

**Step 4: Run tests**

```bash
npm test -- --watchAll=false
```
Expected: all pass.

**Step 5: Commit**

```bash
git add src/context/GraphContext.js
git commit -m "feat: extend reducer DELETE_NODE and ADD_EDGE for subtheme type"
```

---

## Task 3: Render subtheme nodes in `GraphNode.js`

**Files:**
- Modify: `src/components/nodes/GraphNode.js`

**Step 1: Add `isSubtheme` flag and import `getNodeSize` result**

After the existing `const isTheme = node.type === 'theme';` line, add:
```js
const isSubtheme = node.type === 'subtheme';
```

**Step 2: Derive dimensions**

Replace the existing `const { diameter, fontSize } = getNodeSize(node);` + `radius` lines with:

```js
const { diameter, fontSize, width: subthemeWidth } = getNodeSize(node);
const radius = isSubtheme ? null : diameter / 2;
```

**Step 3: Update `getBoxShadow`**

Subthemes should get the same themed hard shadow as themes:
```js
if (isSubtheme) {
  return `6px 6px 0 ${color}88`;
}
```
Add this case after the `isConnecting` check, before the `isTheme` check.

**Step 4: Update the `style` object on `motion.div`**

Replace the static `width/height/borderRadius/backgroundColor` with conditional values:

```js
width:           isSubtheme ? subthemeWidth : diameter,
height:          isSubtheme ? 'auto'        : diameter,
minHeight:       isSubtheme ? 48            : undefined,
borderRadius:    isSubtheme ? 12            : '50%',
backgroundColor: (isTheme || isSubtheme) ? color : '#ffffff',
border:          `${isTheme || isSubtheme ? 3 : 2}px solid ${borderColor}`,
left:            position ? (isSubtheme ? position.x - subthemeWidth / 2 : position.x - radius) : 0,
top:             position ? (isSubtheme ? position.y - 24              : position.y - radius)   : 0,
zIndex:          isSelected || isConnecting ? 20 : (isTheme ? 12 : (isSubtheme ? 11 : 10)),
```

**Step 5: Update label color**

```js
color: (isTheme || isSubtheme) ? 'white' : '#0f0d0a',
fontWeight: (isTheme || isSubtheme) ? 700 : 600,
```

**Step 6: Update `aria-label`**

```js
aria-label={`${node.label || 'Unnamed'} — ${isTheme ? 'theme' : isSubtheme ? 'subtheme' : 'code'} node`}
```

**Step 7: Update CSS class**

```js
className={isTheme ? 'graph-node graph-node--theme' : isSubtheme ? 'graph-node graph-node--subtheme' : 'graph-node graph-node--code'}
```

**Step 8: Start dev server and visually verify**

```bash
npm start
```
Add a theme, add a subtheme — check it renders as a rounded rectangle with theme color. Confirm it matches code/theme in search dim, focus dim.

**Step 9: Commit**

```bash
git add src/components/nodes/GraphNode.js
git commit -m "feat: render subtheme nodes as rounded rectangles in GraphNode"
```

---

## Task 4: Create `SubthemeEditModal.js`

**Files:**
- Create: `src/components/modals/SubthemeEditModal.js`

**Step 1: Write the modal**

Model it closely on `ThemeEditModal.js` but with label only (no color picker):

```jsx
import React, { useState, useEffect } from 'react';
import { useGraph, useGraphDispatch } from '../../context/GraphContext';

export default function SubthemeEditModal({ nodeId, onClose }) {
  const { nodes } = useGraph();
  const dispatch  = useGraphDispatch();
  const node = nodes.find(n => n.id === nodeId) ?? null;
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (node) setLabel(node.label);
  }, [nodeId]); // eslint-disable-line

  useEffect(() => {
    if (!node) return;
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [node, onClose]);

  if (!node) return null;

  function handleSave() {
    dispatch({ type: 'UPDATE_NODE', id: nodeId, changes: { label: label.trim() || node.label } });
    onClose();
  }

  function handleDelete() {
    if (window.confirm(`Delete subtheme "${node.label}"?`)) {
      dispatch({ type: 'DELETE_NODE', id: nodeId });
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="subtheme-edit-modal-title"
        className="bg-white border-2 border-[#0f0d0a] p-7 w-[480px] max-w-full shadow-[8px_8px_0_#0f0d0a]"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="subtheme-edit-modal-title" className="text-xl font-bold text-[#0f0d0a] mb-6">Edit Subtheme</h2>

        <label className="block text-base font-bold text-[#0f0d0a] mb-2">Subtheme Name</label>
        <input
          className="w-full bg-white border-2 border-[#0f0d0a] px-4 py-3 text-base text-[#0f0d0a] placeholder-[#6b6560] mb-6 focus:outline-none focus:border-[#dc2626] font-bold"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Enter subtheme name…"
          autoFocus
        />

        <div className="flex justify-between items-center">
          <button onClick={handleDelete} className="text-base font-bold text-[#dc2626] border-2 border-[#dc2626] px-4 py-2 hover:bg-[#dc2626] hover:text-white transition-colors">
            Delete Subtheme
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="text-base font-bold text-[#0f0d0a] px-5 py-2 border-2 border-[#0f0d0a] hover:bg-[#0f0d0a] hover:text-white transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} className="text-base font-bold text-white px-5 py-2 bg-[#dc2626] border-2 border-[#dc2626] shadow-[3px_3px_0_#0f0d0a] hover:bg-[#b91c1c] transition-colors">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Run tests**

```bash
npm test -- --watchAll=false
```

**Step 3: Commit**

```bash
git add src/components/modals/SubthemeEditModal.js
git commit -m "feat: add SubthemeEditModal (label-only edit)"
```

---

## Task 5: Wire subtheme creation into `App.js` and `Toolbar.js`

**Files:**
- Modify: `src/App.js`
- Modify: `src/components/Toolbar.js`

**Step 1: Add `subthemeEditId` state and `handleAddSubtheme` in `App.js`**

```js
const [subthemeEditId, setSubthemeEditId] = useState(null);

function handleAddSubtheme() {
  const cx = window.innerWidth  / 2 + (Math.random() - 0.5) * 200;
  const cy = window.innerHeight / 2 + (Math.random() - 0.5) * 200;
  dispatch({
    type: 'ADD_NODE',
    node: { id: makeId('subtheme'), type: 'subtheme', label: 'New Subtheme', primaryThemeId: null, color: UNASSIGNED_COLOR, x: cx, y: cy },
  });
}
```

**Step 2: Import and render `SubthemeEditModal` in `App.js`**

Add import:
```js
import SubthemeEditModal from './components/modals/SubthemeEditModal';
```

Add to JSX beside other modals:
```jsx
<SubthemeEditModal nodeId={subthemeEditId} onClose={() => setSubthemeEditId(null)} />
```

**Step 3: Add subtheme to status bar**

```js
const subthemeCount = nodes.filter(n => n.type === 'subtheme').length;
```
Add `<span>{subthemeCount} subthemes</span>` to the status bar.

**Step 4: Pass `onAddSubtheme` to `Toolbar`**

```jsx
<Toolbar
  ...
  onAddSubtheme={handleAddSubtheme}
/>
```

**Step 5: Add "Add Subtheme" button in `Toolbar.js`**

Add `onAddSubtheme` to the Toolbar props destructuring. Add the button next to "Add Theme":

```jsx
<TbBtn onClick={onAddSubtheme}>+ Subtheme</TbBtn>
```

**Step 6: Verify visually** — click "+ Subtheme" in toolbar, confirm node appears on canvas.

**Step 7: Commit**

```bash
git add src/App.js src/components/Toolbar.js src/components/modals/SubthemeEditModal.js
git commit -m "feat: wire subtheme creation via toolbar and SubthemeEditModal"
```

---

## Task 6: Add subtheme context menu items in `App.js`

**Files:**
- Modify: `src/App.js`

**Step 1: Add a `subtheme` context menu branch in `handleContextMenu`**

```js
} else if (type === 'subtheme') {
  items = [
    { label: '✏ Rename Subtheme', action: () => setSubthemeEditId(id) },
    { label: '✕ Delete Subtheme', action: () => dispatch({ type: 'DELETE_NODE', id }), danger: true },
  ];
}
```

**Step 2: Add "Add Subtheme" to the theme context menu**

In the `theme` branch of `handleContextMenu`, insert after "Rename":

```js
{ label: '＋ Add Subtheme', action: () => {
    const themeNode = nodes.find(n => n.id === id);
    const subId = makeId('subtheme');
    dispatch({ type: 'ADD_NODE', node: {
      id: subId, type: 'subtheme', label: 'New Subtheme',
      primaryThemeId: id, color: themeNode?.color ?? UNASSIGNED_COLOR,
      x: x + 160, y: y + 80,
    }});
    dispatch({ type: 'ADD_EDGE', edge: { id: makeId('edge'), source: subId, target: id }});
    setSubthemeEditId(subId);
  }
},
```

**Step 3: Forward subtheme context menu from Canvas**

In `Canvas.js`, the `handleNodeContextMenu` already passes `node.type`. Confirm the Canvas calls `onContextMenu(node.type, node.id, x, y)` — if it currently passes `'theme-edit'` or `'code-edit'` for double-click vs right-click, add a `'subtheme'` case. No change needed if it already passes `node.type` directly.

**Step 4: Visual test** — right-click a theme node, confirm "＋ Add Subtheme" appears and creates a linked subtheme. Right-click a subtheme, confirm "Rename" and "Delete" appear.

**Step 5: Commit**

```bash
git add src/App.js
git commit -m "feat: add subtheme context menu items (add from theme, rename, delete)"
```

---

## Task 7: Update focus view for subtheme two-hop traversal

**Files:**
- Modify: `src/App.js`

**Step 1: Find the `focusedNodeIds` useMemo**

It currently looks like:
```js
const focusedNodeIds = useMemo(() => {
  if (!focusThemeId) return new Set();
  const connected = edges.filter(e => e.source === focusThemeId || e.target === focusThemeId).map(e => e.source === focusThemeId ? e.target : e.source);
  return new Set([focusThemeId, ...connected]);
}, [focusThemeId, edges]);
```

**Step 2: Rewrite for two-hop traversal**

```js
const focusedNodeIds = useMemo(() => {
  if (!focusThemeId) return new Set();

  // Direct neighbours of the theme
  const directNeighbours = edges
    .filter(e => e.source === focusThemeId || e.target === focusThemeId)
    .map(e => e.source === focusThemeId ? e.target : e.source);

  // Subtheme neighbours → also include their code connections
  const subthemeIds = directNeighbours.filter(id => {
    const n = nodes.find(nd => nd.id === id);
    return n?.type === 'subtheme';
  });

  const subthemeNeighbours = subthemeIds.flatMap(stId =>
    edges
      .filter(e => e.source === stId || e.target === stId)
      .map(e => e.source === stId ? e.target : e.source)
  );

  return new Set([focusThemeId, ...directNeighbours, ...subthemeNeighbours]);
}, [focusThemeId, edges, nodes]);
```

**Step 3: Visual test** — create a theme, subtheme, and a code connected to the subtheme. Focus the theme. Confirm all three stay visible; unrelated nodes dim.

**Step 4: Commit**

```bash
git add src/App.js
git commit -m "feat: expand focusedNodeIds to include subtheme two-hop neighbours"
```

---

## Task 8: Update `handleAlign` for subthemes

**Files:**
- Modify: `src/App.js`

**Step 1: Extract subtheme nodes**

```js
const subthemeNodes = nodes.filter(n => n.type === 'subtheme');
```

**Step 2: Position subthemes between theme and its codes**

After the theme ring placement (step 1) and before code ring placement (step 2), insert a subtheme ring step:

```js
// 1b. Subtheme nodes on a ring between theme and its codes
themeNodes.forEach((theme, ti) => {
  const themeAngle = (2 * Math.PI * ti) / themeNodes.length - Math.PI / 2;
  const themeX = cx + Math.cos(themeAngle) * themeRingR;
  const themeY = cy + Math.sin(themeAngle) * themeRingR;
  const connectedSubthemes = subthemeNodes.filter(n => n.primaryThemeId === theme.id);
  const subRingR = 180;
  connectedSubthemes.forEach((sub, si) => {
    const subAngle = (2 * Math.PI * si) / Math.max(connectedSubthemes.length, 1) - Math.PI / 2;
    dispatch({ type: 'UPDATE_NODE', id: sub.id, changes: {
      x: themeX + Math.cos(subAngle) * subRingR,
      y: themeY + Math.sin(subAngle) * subRingR,
    }});
  });
});

// Unassigned subthemes
const unassignedSubthemes = subthemeNodes.filter(n => !n.primaryThemeId);
unassignedSubthemes.forEach((sub, i) => {
  const angle = (2 * Math.PI * i) / Math.max(unassignedSubthemes.length, 1) - Math.PI / 2;
  dispatch({ type: 'UPDATE_NODE', id: sub.id, changes: {
    x: cx + Math.cos(angle) * 160,
    y: cy + Math.sin(angle) * 160,
  }});
});
```

**Step 3: Commit**

```bash
git add src/App.js
git commit -m "feat: include subthemes in handleAlign radial layout"
```

---

## Task 9: Collapsible codes — state and context menu wiring

**Files:**
- Modify: `src/App.js`

**Step 1: Add `collapsedNodeIds` state**

```js
const [collapsedNodeIds, setCollapsedNodeIds] = useState(new Set());

function toggleCollapse(nodeId) {
  setCollapsedNodeIds(prev => {
    const next = new Set(prev);
    if (next.has(nodeId)) next.delete(nodeId);
    else next.add(nodeId);
    return next;
  });
}
```

**Step 2: Add collapse toggle to context menus**

In `handleContextMenu`, add to the `theme` items array:
```js
{
  label: collapsedNodeIds.has(id) ? '⊞ Expand Codes' : '⊟ Collapse Codes',
  action: () => toggleCollapse(id),
},
```

Add the same item to the `subtheme` items array.

**Step 3: Pass `collapsedNodeIds` to Canvas**

```jsx
<Canvas
  ...
  collapsedNodeIds={collapsedNodeIds}
/>
```

**Step 4: Commit**

```bash
git add src/App.js
git commit -m "feat: add collapsedNodeIds state and collapse/expand context menu"
```

---

## Task 10: Implement collapse rendering in `Canvas.js`

**Files:**
- Modify: `src/components/Canvas.js`

**Step 1: Accept `collapsedNodeIds` prop**

Add to Canvas props: `collapsedNodeIds = new Set()`

**Step 2: Derive collapsed code ids**

Inside the Canvas render (or a `useMemo`), compute which code nodes are currently collapsed:

```js
const collapsedCodeIds = useMemo(() => {
  const ids = new Set();
  nodes.forEach(n => {
    if (collapsedNodeIds.has(n.id)) {
      // Find all codes connected to this node
      edges.forEach(e => {
        const codeId = e.source !== n.id ? e.source : e.target;
        const codeNode = nodes.find(nd => nd.id === codeId);
        if (codeNode?.type === 'code') ids.add(codeId);
      });
    }
  });
  return ids;
}, [collapsedNodeIds, nodes, edges]);
```

**Step 3: Hide edges to collapsed codes**

When rendering SVG edges, add `opacity: collapsedCodeIds.has(e.source) || collapsedCodeIds.has(e.target) ? 0 : 1` to edge style. Use a CSS transition `opacity 0.3s ease` so they fade out.

**Step 4: Pass collapse data to each `GraphNode`**

For each node being rendered, pass:
```jsx
isCollapsed={collapsedCodeIds.has(node.id)}
collapsingIntoPosition={/* position of the parent subtheme/theme node */}
```

To compute `collapsingIntoPosition`: find the edge connecting this code to a collapsed parent, then find that parent's position.

**Step 5: Commit**

```bash
git add src/components/Canvas.js
git commit -m "feat: derive collapsedCodeIds and hide edges to collapsed codes"
```

---

## Task 11: Animate collapse/expand in `GraphNode.js`

**Files:**
- Modify: `src/components/nodes/GraphNode.js`

**Step 1: Accept new props**

```js
isCollapsed = false,
collapsingIntoPosition = null,  // { x, y } of parent node in screen coords
isDot = false,  // true for direct-to-theme codes when collapsed
```

**Step 2: Determine collapse mode**

In Canvas, a code connected to a **collapsed subtheme** gets `isCollapsed=true`. A code connected directly to a **collapsed theme** gets `isDot=true`.

**Step 3: Add motion variants for collapse states**

```js
// In GraphNode variants:
collapsed: {
  scale: 0,
  opacity: 0,
  x: collapsingIntoPosition ? collapsingIntoPosition.x - (position?.x ?? 0) : 0,
  y: collapsingIntoPosition ? collapsingIntoPosition.y - (position?.y ?? 0) : 0,
  transition: { type: 'spring', stiffness: 300, damping: 28 },
},
dot: {
  scale: 0.18,
  opacity: 0.6,
  transition: { type: 'spring', stiffness: 280, damping: 25 },
},
```

**Step 4: Drive the animate prop**

```js
animate={
  isCollapsed ? 'collapsed' :
  isDot       ? 'dot'       :
  isConnecting ? 'connecting' : 'visible'
}
```

**Step 5: Add count badge to subtheme nodes when collapsed**

In the subtheme branch rendering, conditionally show a count badge. Pass `collapsedCodeCount` as a prop from Canvas:

```jsx
{isSubtheme && collapsedCodeCount > 0 && (
  <motion.span
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    exit={{ scale: 0, opacity: 0 }}
    style={{
      position: 'absolute', top: -8, right: -8,
      width: 22, height: 22, borderRadius: '50%',
      backgroundColor: 'white', border: '2px solid #0f0d0a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700, color: color,
    }}
  >
    {collapsedCodeCount}
  </motion.span>
)}
```

**Step 6: Visual test** — collapse a subtheme, confirm codes animate into it with spring motion and badge appears. Expand, confirm codes spring back.

**Step 7: Commit**

```bash
git add src/components/nodes/GraphNode.js src/components/Canvas.js
git commit -m "feat: animate code collapse into subtheme/theme with Framer Motion springs"
```

---

## Task 12: Write E2E tests

**Files:**
- Modify: `e2e/app.spec.js`

**Step 1: Add subtheme creation test**

```js
test('creates a subtheme node from toolbar', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.getByRole('button', { name: '+ Subtheme' }).click();
  await expect(page.locator('[data-node-type="subtheme"]')).toBeVisible();
});
```

**Step 2: Add subtheme rename test**

```js
test('renames a subtheme via context menu', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.getByRole('button', { name: '+ Subtheme' }).click();
  const subtheme = page.locator('[data-node-type="subtheme"]');
  await subtheme.click({ button: 'right' });
  await page.getByRole('menuitem', { name: /Rename Subtheme/ }).click();
  await page.getByPlaceholder('Enter subtheme name…').fill('Identity');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(subtheme).toContainText('Identity');
});
```

**Step 3: Add "add subtheme from theme context menu" test**

```js
test('adds a subtheme from a theme context menu', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.getByRole('button', { name: '+ Theme' }).click();
  const theme = page.locator('[data-node-type="theme"]');
  await theme.click({ button: 'right' });
  await page.getByRole('menuitem', { name: /Add Subtheme/ }).click();
  await expect(page.locator('[data-node-type="subtheme"]')).toBeVisible();
});
```

**Step 4: Add collapse/expand test**

```js
test('collapses and expands codes from subtheme context menu', async ({ page }) => {
  await page.goto('http://localhost:3000');
  // Create subtheme and connect a code
  await page.getByRole('button', { name: '+ Subtheme' }).click();
  await page.getByRole('button', { name: '+ Code' }).click();
  // Connect via connect mode (simplified — just verify menu items exist)
  const subtheme = page.locator('[data-node-type="subtheme"]');
  await subtheme.click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: /Collapse Codes/ })).toBeVisible();
  await page.getByRole('menuitem', { name: /Collapse Codes/ }).click();
  await subtheme.click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: /Expand Codes/ })).toBeVisible();
});
```

**Step 5: Run E2E tests**

```bash
npm run test:e2e
```
Expected: all 13 existing + 4 new = 17 tests pass.

**Step 6: Commit**

```bash
git add e2e/app.spec.js
git commit -m "test: add E2E tests for subtheme creation, rename, and collapse/expand"
```

---

## Task 13: Final pass — search filter and import pipeline

**Files:**
- Modify: `src/App.js` (search filters)
- Modify: `src/utils/importUtils.js` (optional: subtheme column)

**Step 1: Add `subthemes` to search filters**

In `App.js`, update the default `searchFilters` state:
```js
const [searchFilters, setSearchFilters] = useState({ themes: true, subthemes: true, codes: true });
```

Update the `matchedNodeIds` useMemo to include subthemes when `searchFilters.subthemes` is true.

Add a "Subthemes" toggle button to the search UI in `Toolbar.js` alongside the existing Themes/Codes buttons.

**Step 2: (Optional) Import pipeline**

If a future import CSV includes a `Subtheme` column, `importUtils.js` should recognize it. For now, add a note in `HEADER_MAP` in `importUtils.js`:
```js
// 'Subtheme' column reserved for future subtheme import support
```

**Step 3: Run all tests**

```bash
npm test -- --watchAll=false
npm run test:e2e
```
Expected: all pass.

**Step 4: Final commit**

```bash
git add src/App.js src/components/Toolbar.js src/utils/importUtils.js
git commit -m "feat: add subthemes to search filter toggles"
```
