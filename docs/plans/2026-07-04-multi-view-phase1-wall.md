# Multi-View Phase 1: View Switcher + Research Wall Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Add a view-switcher architecture with v2 storage migration, and ship the Research Wall — a physics-free, authored-position workbench where theme assignment happens by placing code cards inside theme regions.

**Architecture:** `GraphContext` remains the single source of truth; views are projections. The existing force canvas stays as "Graph" view (default, so all 21 e2e tests pass unchanged). `WallView` renders cards at `node.wallPosition`, theme `regions[]` as tinted rectangles, and typed edges as sagging strings. Assignment-by-placement reuses existing reducer actions plus two new ones. Design doc: `docs/plans/2026-07-04-multi-view-roadmap-design.md`.

**Tech Stack:** React 19 (CRA), existing D3 v7 (zoom only — no simulation on the Wall), Tailwind + inline styles, Jest, Playwright. **No new dependencies.**

**Conventions that apply to every task** (from CLAUDE.md):
- All state changes via `dispatch` — never mutate context.
- Functional components only. Tailwind for layout, inline style for dynamic values.
- `motion.div` with `role="button"`, never `motion.button`.
- Run unit tests: `$env:CI="true"; npx react-scripts test --watchAll=false`. Run e2e: `npx playwright test --reporter=list`.

---

### Task 1: v2 storage with migration and `regions` in state

**Files:**
- Modify: `src/context/GraphContext.js`
- Test: `src/context/GraphContext.test.js`

**Step 1: Write the failing tests**

Append to `src/context/GraphContext.test.js`:

```js
import { migrateV1ToV2 } from './GraphContext';

describe('v1 → v2 migration', () => {
  test('seeds wallPosition from physics x/y and a region per theme', () => {
    const v1 = {
      nodes: [
        { id: 't1', type: 'theme', label: 'Theme 1', color: '#4f46e5', x: 500, y: 300 },
        { id: 'c1', type: 'code', label: 'Code 1', quote: 'q', source: 's', primaryThemeId: 't1', color: '#4f46e5', x: 620, y: 340 },
      ],
      edges: [{ id: 'e1', source: 'c1', target: 't1' }],
    };
    const v2 = migrateV1ToV2(v1);
    expect(v2.nodes.find(n => n.id === 'c1').wallPosition).toEqual({ x: 620, y: 340 });
    expect(v2.regions).toHaveLength(1);
    expect(v2.regions[0]).toMatchObject({ themeId: 't1' });
    expect(v2.regions[0].rect.w).toBeGreaterThan(0);
    expect(v2.edges).toEqual(v1.edges); // untouched
  });

  test('nodes without x/y get no wallPosition (Wall places them in the margin)', () => {
    const v2 = migrateV1ToV2({ nodes: [{ id: 'c1', type: 'code', label: 'C' }], edges: [] });
    expect(v2.nodes[0].wallPosition).toBeUndefined();
  });
});

describe('regions in reducer state', () => {
  const regionState = {
    nodes: [
      { id: 't1', type: 'theme', label: 'T', color: '#4f46e5', x: 0, y: 0 },
      { id: 'c1', type: 'code', label: 'C', primaryThemeId: 't1', color: '#4f46e5', x: 0, y: 0 },
    ],
    edges: [{ id: 'e1', source: 'c1', target: 't1' }],
    regions: [{ id: 'region-t1', themeId: 't1', rect: { x: -220, y: -160, w: 440, h: 320 } }],
  };

  test('DELETE_NODE preserves regions of other themes and removes the deleted theme region', () => {
    const next = graphReducer(regionState, { type: 'DELETE_NODE', id: 't1' });
    expect(next.regions).toEqual([]); // cascade
  });

  test('DELETE_NODE of a code leaves regions untouched', () => {
    const next = graphReducer(regionState, { type: 'DELETE_NODE', id: 'c1' });
    expect(next.regions).toEqual(regionState.regions);
  });

  test('UPDATE_REGION changes rect; unknown id is a no-op', () => {
    const next = graphReducer(regionState, {
      type: 'UPDATE_REGION', id: 'region-t1', changes: { rect: { x: 0, y: 0, w: 100, h: 100 } },
    });
    expect(next.regions[0].rect).toEqual({ x: 0, y: 0, w: 100, h: 100 });
    expect(graphReducer(regionState, { type: 'UPDATE_REGION', id: 'nope', changes: {} })).toBe(regionState);
  });

  test('UNASSIGN_CODE clears primaryThemeId, reverts color, and removes the theme edge atomically', () => {
    const next = graphReducer(regionState, { type: 'UNASSIGN_CODE', id: 'c1' });
    const c1 = next.nodes.find(n => n.id === 'c1');
    expect(c1.primaryThemeId).toBeNull();
    expect(c1.color).toBe(UNASSIGNED_COLOR);
    expect(next.edges).toEqual([]);
  });

  test('CLEAR resets regions too', () => {
    expect(graphReducer(regionState, { type: 'CLEAR' }).regions).toEqual([]);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `$env:CI="true"; npx react-scripts test --watchAll=false`
Expected: FAIL — `migrateV1ToV2` is not exported; region cases missing.

**Step 3: Implement in `GraphContext.js`**

3a. Storage keys and migration (below `UNASSIGNED_COLOR`):

```js
const STORAGE_KEY_V1 = 'thematic_analysis_graph_v1';
const STORAGE_KEY    = 'thematic_analysis_graph_v2';

/** Default region size seeded around a theme's last physics position */
const SEED_REGION = { w: 440, h: 320 };

/** Pure v1 → v2 migration. Exported for tests. */
export function migrateV1ToV2(v1) {
  const nodes = v1.nodes.map(n =>
    (typeof n.x === 'number' && typeof n.y === 'number')
      ? { ...n, wallPosition: { x: n.x, y: n.y } }
      : n
  );
  const regions = v1.nodes
    .filter(n => n.type === 'theme' && typeof n.x === 'number')
    .map(t => ({
      id: `region-${t.id}`,
      themeId: t.id,
      rect: { x: t.x - SEED_REGION.w / 2, y: t.y - SEED_REGION.h / 2, ...SEED_REGION },
    }));
  return { nodes, edges: v1.edges, regions };
}
```

3b. `initialState` becomes `{ nodes: [], edges: [], regions: [] }`.

3c. **CRITICAL — audit every reducer case that returns an object literal.** `DELETE_NODE`, `DELETE_NODES`, `BULK_ASSIGN_THEME`, `ADD_EDGE`, `DELETE_EDGE` currently return `{ nodes, edges }`, which would silently **drop `regions`**. Change each to spread state, e.g. `return { ...state, nodes: ..., edges: ... }`. In `DELETE_NODE`, when the deleted node is a theme, also cascade:

```js
regions: (state.regions || []).filter(r => r.themeId !== action.id),
```

(and equivalently in `DELETE_NODES` with the `idSet`). `SET_GRAPH` becomes `return { nodes: action.nodes, edges: action.edges, regions: action.regions ?? [] };` and `CLEAR` returns `{ nodes: [], edges: [], regions: [] }`.

3d. New reducer cases:

```js
case 'ADD_REGION': {
  if (state.regions.some(r => r.id === action.region.id)) return state;
  return { ...state, regions: [...state.regions, action.region] };
}

case 'UPDATE_REGION': {
  if (!state.regions.some(r => r.id === action.id)) return state;
  return {
    ...state,
    regions: state.regions.map(r => r.id === action.id ? { ...r, ...action.changes } : r),
  };
}

case 'DELETE_REGION':
  return { ...state, regions: state.regions.filter(r => r.id !== action.id) };

case 'UNASSIGN_CODE': {
  const code = state.nodes.find(n => n.id === action.id);
  if (!code || !code.primaryThemeId) return state;
  const themeId = code.primaryThemeId;
  return {
    ...state,
    nodes: state.nodes.map(n =>
      n.id === action.id ? { ...n, primaryThemeId: null, color: UNASSIGNED_COLOR } : n
    ),
    edges: state.edges.filter(e => !(e.source === action.id && e.target === themeId)),
  };
}
```

3e. **History gotcha:** add `'wallPosition'` to `POSITION_ONLY_KEYS` so wall drags don't spam undo history. Also make pure region geometry non-undoable:

```js
const POSITION_ONLY_KEYS = new Set(['x', 'y', 'wallPosition']);

function isUndoable(action) {
  if (action.type === 'SET_GRAPH') return false;
  if (action.type === 'UPDATE_NODE') {
    const keys = Object.keys(action.changes || {});
    return keys.some(k => !POSITION_ONLY_KEYS.has(k));
  }
  if (action.type === 'UPDATE_REGION') {
    const keys = Object.keys(action.changes || {});
    return keys.some(k => k !== 'rect'); // moving/resizing a region isn't undoable
  }
  return true;
}
```

3f. Lazy initializer: try v2 key first; else try v1 and migrate; wrap migration in try/catch — on failure, fall back to reading v1 directly (read-only semantics come free: we simply don't overwrite v1). Keep the v1 key untouched forever (rollback safety):

```js
const [state, dispatch] = useReducer(historyReducer, null, () => {
  try {
    const savedV2 = localStorage.getItem(STORAGE_KEY);
    if (savedV2) {
      const parsed = JSON.parse(savedV2);
      if (parsed.nodes && parsed.edges) {
        return { past: [], present: { regions: [], ...parsed }, future: [] };
      }
    }
    const savedV1 = localStorage.getItem(STORAGE_KEY_V1);
    if (savedV1) {
      const parsed = JSON.parse(savedV1);
      if (parsed.nodes && parsed.edges) {
        return { past: [], present: migrateV1ToV2(parsed), future: [] };
      }
    }
  } catch (e) {
    console.warn('Failed to restore graph from localStorage:', e);
  }
  return { past: [], present: initialState, future: [] };
});
```

Note `{ regions: [], ...parsed }` — v2 saves written before regions existed still load.

**Step 4: Run tests to verify they pass**

Run: `$env:CI="true"; npx react-scripts test --watchAll=false`
Expected: PASS (all suites — the spread-state audit in 3c is what keeps the existing 22 green).

**Step 5: Run e2e to catch the persistence test**

Run: `npx playwright test --reporter=list`
Expected: test 13 (localStorage persistence) FAILS — it reads `thematic_analysis_graph_v1`. Update the `waitForFunction` in `e2e/app.spec.js` to read `thematic_analysis_graph_v2`. Re-run: 21 passed.

**Step 6: Commit**

```bash
git add src/context/GraphContext.js src/context/GraphContext.test.js e2e/app.spec.js
git commit -m "feat: v2 graph storage with regions and v1 migration"
```

---

### Task 2: View state + switcher in Toolbar

**Files:**
- Modify: `src/App.js`, `src/components/Toolbar.js`
- Test: `e2e/app.spec.js` (new test 22)

**Step 1: Add view state to `AppInner`**

```js
const [view, setView] = useState('graph'); // 'wall' | 'graph'
```

Default stays `'graph'` in Phase 1 so all existing e2e tests pass unchanged. Flipping the default to `'wall'` is a deliberate one-line follow-up once the Wall is validated in use (per design doc §1).

**Step 2: Add the switcher to Toolbar**

New props `view`, `onViewChange`. Render a segmented control immediately after the app title (before Import). Only the views that exist are rendered — Sankey/Report buttons arrive with their phases:

```jsx
<div role="group" aria-label="View" className="flex mr-2 border-2 border-white">
  {[['wall', '▦ Wall'], ['graph', '☄ Graph']].map(([key, label]) => (
    <button
      key={key}
      onClick={() => onViewChange(key)}
      aria-pressed={view === key}
      className={`px-3 py-2 font-bold text-base cursor-pointer ${
        view === key ? 'bg-white text-[#0f0d0a]' : 'bg-transparent text-white hover:bg-white/20'
      }`}
    >
      {label}
    </button>
  ))}
</div>
```

**Step 3: Swap the center panel in App.js**

```jsx
{view === 'graph' ? (
  <Canvas ...existing props... />
) : (
  <WallView onContextMenu={handleContextMenu} />
)}
```

For this task only, `WallView` is a placeholder: `src/components/wall/WallView.js` rendering an empty `<div id="canvas-export-target" className="canvas-container" style={{ position:'relative', width:'100%', height:'100%', backgroundColor:'var(--bg-canvas)' }} />`. Graph-only toolbar buttons (`Connect`, `Physics`, `Align`, `Fit View`, zoom) get `disabled={view !== 'graph'}` via a new `graphOnly` prop passed to `TbBtn` — they disable, not disappear (design §1).

**Step 4: Add e2e test 22**

```js
test('22 — view switcher toggles between Graph and Wall', async ({ page }) => {
  await expect(page.getByRole('button', { name: /Graph/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /Wall/ }).click();
  await expect(page.getByRole('button', { name: /Wall/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /Connect/ })).toBeDisabled();
  await page.getByRole('button', { name: /Graph/ }).click();
  await expect(page.locator('.nodes-layer')).toBeVisible();
});
```

**Step 5: Run all tests**

Run: `$env:CI="true"; npx react-scripts test --watchAll=false` then `npx playwright test --reporter=list`
Expected: unit PASS; e2e 22 passed.

**Step 6: Commit**

```bash
git add src/App.js src/components/Toolbar.js src/components/wall/WallView.js e2e/app.spec.js
git commit -m "feat: view switcher with Wall placeholder; graph-only actions disable off-view"
```

---

### Task 3: WallView surface — cards, margin tray, pan/zoom

**Files:**
- Create: `src/components/wall/WallCard.js`
- Modify: `src/components/wall/WallView.js`

**Step 1: WallCard component**

Index-card look; reuses node data. Complete component:

```jsx
import React from 'react';

export const CARD_W = 176;
export const CARD_H = 96;

export default function WallCard({ node, position, contested = false, inTray = false,
  onPointerDown, onPointerMove, onPointerUp, onContextMenu, onKeyDown }) {
  const quoteLine = (node.quote || '').split('\n')[0];
  return (
    <div
      role="button"
      tabIndex={0}
      data-node-type="code"
      data-card-id={node.id}
      aria-label={`${node.label || 'Unnamed'} — code card${contested ? ', contested between regions' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={onContextMenu}
      onKeyDown={onKeyDown}
      style={{
        position: inTray ? 'relative' : 'absolute',
        left: inTray ? undefined : position.x - CARD_W / 2,
        top:  inTray ? undefined : position.y - CARD_H / 2,
        width: CARD_W, minHeight: CARD_H,
        backgroundColor: '#ffffff',
        border: '2px solid #0f0d0a',
        borderTop: `6px solid ${node.color || '#6b7280'}`,
        boxShadow: '4px 4px 0 #0f0d0a',
        padding: '8px 10px', cursor: 'grab',
        touchAction: 'none', userSelect: 'none',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}
    >
      <span style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2, color: '#0f0d0a' }}>
        {node.label || 'Untitled Code'}
      </span>
      {quoteLine && (
        <span style={{ fontSize: 12, fontStyle: 'italic', color: '#6b6560',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          "{quoteLine}"
        </span>
      )}
      {node.source && (
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: '#6b6560', marginTop: 'auto', alignSelf: 'flex-end' }}>
          {node.source}
        </span>
      )}
      {contested && (
        <span aria-hidden="true" style={{ position: 'absolute', top: -8, left: -8,
          width: 18, height: 18, backgroundColor: '#dc2626', color: 'white',
          fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center',
          justifyContent: 'center', border: '2px solid #0f0d0a' }}>?</span>
      )}
    </div>
  );
}
```

**Step 2: WallView layout**

Structure (all inside the `id="canvas-export-target"` root):
- **Margin tray:** left strip, `width: 208px`, `overflow-y: auto`, cream bg with `borderRight: '2px solid #0f0d0a'`, heading "UNSORTED" (11px, 800, letter-spaced). Contains a `WallCard inTray` for every code with `!primaryThemeId && !node.wallPosition`. Dragging out of the tray (Task 4) gives the card a `wallPosition`.
- **Wall surface:** remaining space, `position: relative; overflow: hidden`. A transformed inner layer (`transformOrigin: '0 0'`) holds regions (Task 5), an SVG string layer (Task 8), and absolute-positioned `WallCard`s for every code **with** a `wallPosition`. Theme nodes do not render as cards — themes *are* regions on the Wall.
- **Pan/zoom:** copy the d3.zoom pattern from `Canvas.js` (zoom behavior on the surface div's child SVG or on the surface itself via `d3.select(surfaceRef.current).call(zoom)`, `scaleExtent([0.3, 3])`), storing `{x, y, k}` in a ref and applying `transform` to the inner layer. No simulation, no tick loop — re-render only on React state change.

Wall position source: `node.wallPosition ?? null`; nodes with neither `wallPosition` nor assignment sit in the tray; assigned nodes without `wallPosition` (created in Graph view) fall back to `{x: node.x, y: node.y}`.

**Step 3: Verify manually via preview**

Run preview server `thematic-app`; switch to Wall; confirm imported sample CSV shows cards, tray holds the unassigned one, pan/zoom works, no console errors.

**Step 4: Commit**

```bash
git add src/components/wall/
git commit -m "feat: WallView surface with code cards, margin tray, pan/zoom"
```

---

### Task 4: Card dragging with authored positions

**Files:**
- Modify: `src/components/wall/WallView.js`

**Step 1: Pointer drag handlers**

Adapt the `dragStateRef` pattern from `Canvas.js` (pointer capture, 3px movement threshold), but with **no simulation**: during `pointermove`, update a local `dragPositions` React state Map (id → {x, y}) converting client coords through the zoom transform; on `pointerup`, dispatch once:

```js
dispatch({ type: 'UPDATE_NODE', id, changes: { wallPosition: { x, y } } });
```

(One dispatch per completed drag; non-undoable because `wallPosition` is in `POSITION_ONLY_KEYS` — verified by Task 1.)

**Step 2: Tray → wall drag**

A tray card's `pointerdown` starts the same drag; when the pointer crosses the tray's right edge, render it as an absolute card following the cursor. Drop dispatches `wallPosition` as above. (Wall → tray is not a gesture; unassignment is dragging out of a region, Task 6.)

**Step 3: Manual verify + e2e test 23**

```js
test('23 — wall card drag persists position', async ({ page }) => {
  await page.getByRole('button', { name: /Add Code/i }).click();
  await page.getByRole('button', { name: /Wall/ }).click();
  const card = page.locator('[data-card-id]').first();
  const box = await card.boundingBox();
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 220, box.y + 120, { steps: 8 });
  await page.mouse.up();
  await page.reload();
  await page.getByRole('button', { name: /Wall/ }).click();
  const after = await page.locator('[data-card-id]').first().boundingBox();
  expect(Math.abs(after.x - (box.x + 200))).toBeLessThan(40);
});
```

Note: a code added via toolbar has a `wallPosition` only after Task 1's migration path if it has x/y — `handleAddCode` sets x/y, so give `ADD_NODE` calls in `App.js` a matching `wallPosition: { x: cx, y: cy }` in this task.

**Step 4: Run e2e, commit**

```bash
git add src/components/wall/WallView.js src/App.js e2e/app.spec.js
git commit -m "feat: authored card positions with drag on the Wall"
```

---

### Task 5: Theme regions — render, move, resize, create

**Files:**
- Create: `src/components/wall/WallRegion.js`
- Modify: `src/components/wall/WallView.js`, `src/App.js`

**Step 1: WallRegion component**

Tinted rect (`backgroundColor: color + '22'`, `border: 3px solid ${color}`), label plate top-left (theme color bg, white 700-weight text), drag by label plate, resize by a 16×16 bottom-right handle (both via pointer events updating a local rect during drag, one `UPDATE_REGION {rect}` dispatch on release — non-undoable per Task 1). `data-region-id` attribute for tests. Right-click forwards to `onContextMenu('theme', region.themeId, e.clientX, e.clientY)` so the existing theme menu (rename/recolor/delete/focus) works on regions unchanged.

**Step 2: Region creation**

Themes created in either view auto-get a region: in `handleAddTheme` (App.js), after `ADD_NODE`, also dispatch:

```js
dispatch({ type: 'ADD_REGION', region: {
  id: `region-${themeId}`, themeId,
  rect: { x: cx - 220, y: cy - 160, w: 440, h: 320 },
}});
```

(Existing themes got regions via migration; a theme whose region was deleted can recreate it via a new "▦ Show on Wall" context-menu item that dispatches the same `ADD_REGION`.)

**Step 3: Unit test the geometry helper**

Create `src/utils/wallGeometry.js` with pure functions + `src/utils/wallGeometry.test.js`:

```js
export function cardRect(pos, w = 176, h = 96) {
  return { x: pos.x - w / 2, y: pos.y - h / 2, w, h };
}
export function containment(card, region) {
  const fully = card.x >= region.x && card.y >= region.y &&
    card.x + card.w <= region.x + region.w && card.y + card.h <= region.y + region.h;
  const overlaps = card.x < region.x + region.w && card.x + card.w > region.x &&
    card.y < region.y + region.h && card.y + card.h > region.y;
  return { fully, overlaps };
}
```

Tests: fully-inside, partial-overlap, disjoint, exact-edge cases.

**Step 4: Run tests, verify in preview, commit**

```bash
git add src/components/wall/ src/utils/wallGeometry.js src/utils/wallGeometry.test.js src/App.js
git commit -m "feat: theme regions on the Wall with move/resize"
```

---

### Task 6: Assignment by placement + contested marks

**Files:**
- Modify: `src/components/wall/WallView.js`
- Test: `src/utils/wallGeometry.test.js`, e2e test 24

**Step 1: Write the failing unit test for the decision function**

Add to `wallGeometry.js` / test file:

```js
/**
 * Decide assignment after a card drop.
 * Returns { assignTo: themeId } | { unassign: true } | { keep: true }.
 */
export function assignmentAfterDrop(card, regions, currentThemeId) {
  const fully = regions.filter(r => containment(card, r.rect).fully);
  const overlapping = regions.filter(r => containment(card, r.rect).overlaps);
  if (fully.length === 1 && overlapping.length === 1) {
    return fully[0].themeId === currentThemeId ? { keep: true } : { assignTo: fully[0].themeId };
  }
  if (overlapping.length === 0) {
    return currentThemeId ? { unassign: true } : { keep: true };
  }
  return { keep: true }; // partial or multi-overlap → contested, keep assignment
}

export function isContested(card, regions) {
  const overlapping = regions.filter(r => containment(card, r.rect).overlaps);
  const fullyIn = regions.filter(r => containment(card, r.rect).fully);
  return overlapping.length >= 2 || (overlapping.length === 1 && fullyIn.length === 0);
}
```

Tests: drop fully inside one region → assign; drop in empty wall while assigned → unassign; straddling two regions → keep + contested; half-in-half-out of one region → keep + contested.

**Step 2: Wire into drop handling**

On card `pointerup` in WallView:

```js
const decision = assignmentAfterDrop(cardRect(pos), regions, node.primaryThemeId);
if (decision.assignTo) {
  dispatch({ type: 'BULK_ASSIGN_THEME', nodeIds: [node.id], targetId: decision.assignTo });
} else if (decision.unassign) {
  dispatch({ type: 'UNASSIGN_CODE', id: node.id });
}
```

(`BULK_ASSIGN_THEME` already sets `primaryThemeId`, color, and creates the edge — reuse, don't reimplement. Both actions are undoable — assignment is an analytic act.)

Render-time contested: compute `isContested(...)` per card, pass to `WallCard contested`.

**Step 3: e2e test 24**

Add theme + code in Graph view, switch to Wall, drag the card into the region's center, assert status bar unassigned drops to 0; drag it out to empty wall, assert unassigned returns to 1.

**Step 4: Run all tests, commit**

```bash
git add src/utils/wallGeometry.js src/utils/wallGeometry.test.js src/components/wall/WallView.js e2e/app.spec.js
git commit -m "feat: assignment by placement with contested marks"
```

---

### Task 7: Card piles (stacking)

**Files:**
- Modify: `src/components/wall/WallView.js`, `src/components/wall/WallCard.js`

**Step 1: Pile semantics (no new state shape)**

A pile is **derived, not stored**: cards whose centers are within 28px of each other cluster into one pile (computed with a simple pass at render). The top card renders normally; others render beneath with `rotate((i % 3 - 1) * 2.5deg)` offsets and a count badge (white circle, 2px border — same recipe as the subtheme collapse badge in `GraphNode.js`). Clicking a pile's badge fans the pile: temporarily offsets members by 24px steps (local state, cleared on next canvas click) so any member can be grabbed.

Deriving piles keeps undo, migration, and the data model untouched — YAGNI on a `pileId` field until fan-out proves insufficient.

**Step 2: Unit test the clustering helper**

`clusterPiles(cards, threshold)` in `wallGeometry.js`: given `[{id, x, y}]`, returns arrays of ids grouped by proximity (single-link). Tests: two far cards → two piles of 1; three cards within threshold chain → one pile of 3.

**Step 3: Verify in preview (drop two cards together, see badge, fan, grab), commit**

```bash
git add src/utils/wallGeometry.js src/utils/wallGeometry.test.js src/components/wall/
git commit -m "feat: derived card piles with fan-out on the Wall"
```

---

### Task 8: String edges

**Files:**
- Modify: `src/components/wall/WallView.js`

**Step 1: SVG layer under the cards (inside the transformed layer)**

For each edge: endpoint = card center (codes) or region label-plate center (themes; skip edge if region missing). Sagging string:

```jsx
const midX = (x1 + x2) / 2;
const midY = (y1 + y2) / 2 + Math.hypot(x2 - x1, y2 - y1) * 0.08; // sag
<path
  d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`}
  stroke={edgeColor} strokeWidth={getEdgeStrokeWidth(edge.relationType)}
  strokeDasharray={getEdgeDashArray(edge.relationType) || undefined}
  fill="none" strokeLinecap="round" opacity={0.55}
/>
```

Reuse `edgeTypes.js` helpers and the label-rect pattern from `Canvas.js` (place at the quadratic midpoint `t=0.5`: `(x1 + 2*midX + x2) / 4` etc.). Include a transparent 16px hit path per edge → existing `onContextMenu('edge', ...)` so the relationship panel works on the Wall.

**Step 2: Verify in preview (assign codes, see sagging typed strings, click one → relationship menu), commit**

```bash
git add src/components/wall/WallView.js
git commit -m "feat: sagging string edges with relationship editing on the Wall"
```

---

### Task 9: Keyboard support

**Files:**
- Modify: `src/components/wall/WallCard.js`, `src/components/wall/WallView.js`

**Step 1: Arrow-key movement + Enter menu**

`onKeyDown` per card: Arrow keys move the card 8px (1px with Shift) by dispatching `UPDATE_NODE {wallPosition}` (throttle: dispatch on keyup or every 150ms — single history-free updates); after movement stops, run the same `assignmentAfterDrop` decision as pointer drops. Enter/Space opens the context menu at the card center (same synthetic-event pattern as `GraphNode.js`). Cards and region label plates are tabbable; `:focus-visible` ring comes free from `index.css`.

**Step 2: e2e test 25** — Tab to a card, press ArrowRight ×5, assert its `boundingBox().x` increased; press Enter, assert `menuitem` visible.

**Step 3: Run e2e, commit**

```bash
git add src/components/wall/ e2e/app.spec.js
git commit -m "feat: keyboard movement and menu access for wall cards"
```

---

### Task 10: Region-framed export

**Files:**
- Modify: `src/utils/exportUtils.js`, `src/App.js`

**Step 1: Add `exportRegionToPng`**

```js
export async function exportRegionToPng(element, cropRect, filename = 'theme-figure') {
  if (!element) throw new Error('exportRegionToPng: canvas element is null');
  const canvas = await html2canvas(element, {
    backgroundColor: '#f0ebe3', scale: 2, useCORS: true, logging: false,
    x: cropRect.x, y: cropRect.y, width: cropRect.w, height: cropRect.h,
  });
  const link = document.createElement('a');
  link.download = `${filename}-${datestamp()}.png`;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
}
```

`cropRect` is the region's rect converted world → screen via the wall's zoom transform (expose the transform the same way Canvas exposes `screenToWorld`, inverted), padded by 24px.

**Step 2: Menu item** — theme context menu, Wall view only: "⬇ Export Region as PNG". Manual verify: exported PNG shows only that region's frame.

**Step 3: Commit**

```bash
git add src/utils/exportUtils.js src/App.js src/components/wall/WallView.js
git commit -m "feat: per-theme region export from the Wall"
```

---

### Task 11: Full regression + docs

**Step 1:** Run everything: unit + full e2e (expect 25 passing). Fix any drift.

**Step 2:** Update `CLAUDE.md`: add WallView/WallCard/WallRegion + wallGeometry to Key Files; document v2 storage key + migration; note `wallPosition` in the state shape and the POSITION_ONLY_KEYS rule; add the "reducer cases must spread state or drop `regions`" gotcha to Bug History.

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document Wall view, v2 storage, and regions conventions"
```

---

## Out of scope for this plan

Sankey lens (native task #3) and Living Report (native task #4) get their own plans after Phase 1 ships. Flipping the default view to Wall is a deliberate post-validation follow-up.
