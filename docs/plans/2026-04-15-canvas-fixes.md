# Canvas Fixes & Viewport Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Fix the connection line coordinate mismatch, add a fit-to-viewport button, auto-center nodes on open, and add a gravity force to prevent node drift.

**Architecture:** All changes are confined to five files. The connection line is moved from a conditionally-rendered SVG group (which misses D3's zoom transform) to a screen-space `<line>` directly inside `<svg>`. Fit-to-viewport is implemented as a `useCallback` in Canvas using a stored `zoomBehaviorRef`, exposed to App via an `onFitReady` prop. Gravity replaces the weak `forceCenter` with `forceX`/`forceY` at a tunable strength.

**Tech Stack:** React 19, D3 v7, Framer Motion, Tailwind CSS (no test framework — verify visually via `npm start`)

---

## Task 1: Add gravity force to forceSimulation.js

**Files:**
- Modify: `src/utils/forceSimulation.js`

**Context:** The current `forceCenter(...).strength(0.03)` translates all nodes' center of mass — it doesn't add individual velocity toward center. Replace it with `forceX` + `forceY`, which exert a true gravitational pull on each node.

**Step 1: Add `gravity` to DEFAULT_PHYSICS**

In `src/utils/forceSimulation.js`, change the `DEFAULT_PHYSICS` object from:
```js
export const DEFAULT_PHYSICS = {
  linkDistance:    180,
  repulsion:       -300,
  collisionRadius: 80,
  linkStrength:    0.4,
  velocityDecay:   0.4,
};
```
To:
```js
export const DEFAULT_PHYSICS = {
  linkDistance:    180,
  repulsion:       -300,
  collisionRadius: 80,
  linkStrength:    0.4,
  velocityDecay:   0.4,
  gravity:         0.08,
};
```

**Step 2: Replace forceCenter with forceX + forceY in createSimulation**

In `createSimulation`, replace:
```js
.force('center',  d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2).strength(0.03))
```
With:
```js
.force('x', d3.forceX(window.innerWidth  / 2).strength(params.gravity))
.force('y', d3.forceY(window.innerHeight / 2).strength(params.gravity))
```

**Step 3: Update updateParams to handle gravity**

In the `updateParams` method, add after the existing force updates:
```js
sim.force('x')?.strength(newParams.gravity);
sim.force('y')?.strength(newParams.gravity);
```

Full updated `updateParams`:
```js
updateParams(newParams) {
  sim.force('charge')?.strength(newParams.repulsion);
  sim.force('link')?.distance(newParams.linkDistance).strength(newParams.linkStrength);
  sim.force('collide')?.radius(newParams.collisionRadius);
  sim.force('x')?.strength(newParams.gravity);
  sim.force('y')?.strength(newParams.gravity);
  sim.velocityDecay(newParams.velocityDecay);
  sim.alpha(0.3).restart();
},
```

**Step 4: Verify build**

```bash
cd D:/thematic-analysis-app && npm start
```
Expected: App starts without errors in the console. Nodes should drift less aggressively.

**Step 5: Commit**

```bash
git add src/utils/forceSimulation.js
git commit -m "feat: replace forceCenter with forceX/forceY gravity force"
```

---

## Task 2: Add gravity slider to PhysicsPanel.js

**Files:**
- Modify: `src/components/PhysicsPanel.js`

**Context:** Expose the new `gravity` param as a slider alongside the existing physics controls. Range 0.01–0.20, step 0.01, displayed as a percentage (multiply by 100).

**Step 1: Add gravity entry to SLIDERS array**

In `src/components/PhysicsPanel.js`, add to the end of the `SLIDERS` array (before the closing `]`):
```js
{ key: 'gravity', label: 'Gravity', min: 1, max: 20, step: 1, unit: '%', transform: v => v / 100 },
```

The full updated SLIDERS array:
```js
const SLIDERS = [
  { key: 'linkDistance',    label: 'Link Distance',     min: 60,   max: 400,  step: 10,  unit: 'px' },
  { key: 'repulsion',       label: 'Repulsion',         min: -600, max: -50,  step: 10,  unit: ''   },
  { key: 'collisionRadius', label: 'Collision Radius',  min: 30,   max: 180,  step: 5,   unit: 'px' },
  { key: 'linkStrength',    label: 'Link Strength',     min: 0,    max: 100,  step: 5,   unit: '%', transform: v => v / 100 },
  { key: 'velocityDecay',   label: 'Velocity Decay',    min: 0,    max: 100,  step: 5,   unit: '%', transform: v => v / 100 },
  { key: 'gravity',         label: 'Gravity',           min: 1,    max: 20,   step: 1,   unit: '%', transform: v => v / 100 },
];
```

**Step 2: Verify visually**

Open Physics panel (⚙ Physics button). Confirm a "Gravity" slider appears at the bottom. Drag it — nodes should tighten toward center at high values, spread loosely at low values.

**Step 3: Commit**

```bash
git add src/components/PhysicsPanel.js
git commit -m "feat: add gravity slider to PhysicsPanel"
```

---

## Task 3: Fix connection line coordinate mismatch in Canvas.js

**Files:**
- Modify: `src/components/Canvas.js`

**Context:** The current connecting line is wrapped in `<g id="connecting-edge">` which is conditionally rendered. D3's zoom handler only sets `transform` on groups that exist in the DOM at zoom-event time, so this group never gets the zoom transform. Fix: remove the group entirely, render a bare `<line>` as a direct `<svg>` child using screen-space coordinates. Source endpoint converts world → screen (`wx*k+tx`); target endpoint is the raw mouse position from `tooltipPos`.

**Step 1: Locate and replace the connecting line block in Canvas.js**

Find this block (lines ~423–443 in Canvas.js):
```jsx
{/* Connecting line (shown during connection mode) */}
{canvasState.connectingFrom && (() => {
  // tooltipPos is in screen space; convert to world space via inverse zoom transform
  const { x: tx, y: ty, k } = zoomTransformRef.current;
  const worldX = (canvasState.tooltipPos.x - TOOLTIP_OFFSET - tx) / k;
  const worldY = (canvasState.tooltipPos.y - TOOLTIP_OFFSET - ty) / k;
  return (
    <g id="connecting-edge">
      <line
        x1={canvasState.connectingFrom.x}
        y1={canvasState.connectingFrom.y}
        x2={worldX}
        y2={worldY}
        stroke="#64748b"
        strokeDasharray="4,4"
        strokeWidth={2}
        opacity={0.7}
        pointerEvents="none"
      />
    </g>
  );
})()}
```

Replace it with:
```jsx
{/* Connecting line — screen-space, direct SVG child (no zoom transform applied) */}
{canvasState.connectingFrom && (() => {
  const { x: tx, y: ty, k } = zoomTransformRef.current;
  // Convert source from world → screen space
  const sx = canvasState.connectingFrom.x * k + tx;
  const sy = canvasState.connectingFrom.y * k + ty;
  // Target is already screen-space (mouse position, no offset)
  const ex = canvasState.tooltipPos.x - TOOLTIP_OFFSET;
  const ey = canvasState.tooltipPos.y - TOOLTIP_OFFSET;
  return (
    <line
      x1={sx}
      y1={sy}
      x2={ex}
      y2={ey}
      stroke="#64748b"
      strokeDasharray="4,4"
      strokeWidth={2}
      opacity={0.7}
      pointerEvents="none"
    />
  );
})()}
```

**Step 2: Verify visually**

1. Start app, add a theme node and a code node.
2. Click "↔ Connect" in toolbar to enter connect mode.
3. Zoom in (mouse wheel) to ~150%.
4. Pan the canvas so nodes are off-center.
5. Click the code node to start a connection.
6. Move the mouse — the dashed line should start exactly at the code node's center and follow the cursor precisely.
7. At zoom 100% with no pan, the behavior should also be correct.

**Step 3: Commit**

```bash
git add src/components/Canvas.js
git commit -m "fix: render connecting line in screen-space to fix zoom misalignment"
```

---

## Task 4: Add zoomBehaviorRef and fitToView to Canvas.js

**Files:**
- Modify: `src/components/Canvas.js`

**Context:** `fitToView` computes a bounding box over all nodes, adds 80px padding, calculates the D3 zoom transform that centers and scales it to fill the SVG, then animates to it. The zoom behavior must be stored in a ref so `fitToView` can call `zoomBehaviorRef.current.transform`.

**Step 1: Add zoomBehaviorRef**

After line `const dragStateRef = useRef(null);` (around line 161), add:
```js
const zoomBehaviorRef = useRef(null);
```

**Step 2: Store zoom behavior in ref inside the zoom setup useEffect**

Inside the zoom setup `useEffect` (around line 165), after:
```js
const zoomBehavior = d3.zoom()
  .scaleExtent([MIN_ZOOM, MAX_ZOOM])
  .on('zoom', (event) => { ... });
```

Add immediately after the `.on('zoom', ...)` call and before `svg.call(zoomBehavior)`:
```js
zoomBehaviorRef.current = zoomBehavior;
```

**Step 3: Add fitToView function**

Add this after the `handleThemeNodeMouseLeave` callback (around line 330) and before the `edgeListMemo` useMemo:

```js
// ── Fit to View ───────────────────────────────────────────────────────────

const fitToView = useCallback(() => {
  if (!zoomBehaviorRef.current || !svgRef.current) return;

  const svgEl = svgRef.current;
  const width  = svgEl.clientWidth;
  const height = svgEl.clientHeight;
  if (width === 0 || height === 0) return;

  // Build bounding box from all node positions
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  graphState.nodes.forEach(node => {
    const pos      = positions.current.get(node.id) ?? { x: node.x ?? 0, y: node.y ?? 0 };
    const halfSize = node.type === 'theme' ? THEME_NODE_SIZE / 2 : CODE_NODE_SIZE / 2;
    minX = Math.min(minX, pos.x - halfSize);
    minY = Math.min(minY, pos.y - halfSize);
    maxX = Math.max(maxX, pos.x + halfSize);
    maxY = Math.max(maxY, pos.y + halfSize);
  });

  if (!isFinite(minX)) return; // no nodes

  const PADDING = 80;
  minX -= PADDING; minY -= PADDING;
  maxX += PADDING; maxY += PADDING;

  const bboxW = maxX - minX;
  const bboxH = maxY - minY;
  const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(width / bboxW, height / bboxH)));

  const tx = width  / 2 - ((minX + maxX) / 2) * scale;
  const ty = height / 2 - ((minY + maxY) / 2) * scale;

  const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);
  d3.select(svgEl)
    .transition().duration(600)
    .call(zoomBehaviorRef.current.transform, transform);
}, [graphState.nodes, positions]);
```

**Step 4: Accept onFitReady prop and call it once on mount**

Update the Canvas function signature from:
```js
export default function Canvas({
  connectMode = false,
  physicsParams,
  onContextMenu,
}) {
```
To:
```js
export default function Canvas({
  connectMode = false,
  physicsParams,
  onContextMenu,
  onFitReady,
}) {
```

Then add a new `useEffect` after the `fitToView` definition:
```js
// Expose fitToView to parent on mount
useEffect(() => {
  if (onFitReady) onFitReady(fitToView);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // intentionally run once; fitToView captured via closure ref below
```

Since `fitToView` uses `useCallback` and the ref guard pattern, we also need to keep the latest version accessible. Add a ref update:
```js
const fitToViewRef = useRef(fitToView);
useEffect(() => { fitToViewRef.current = fitToView; }, [fitToView]);
```

And update the `onFitReady` effect to pass a stable wrapper:
```js
useEffect(() => {
  if (onFitReady) onFitReady(() => fitToViewRef.current());
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

**Step 5: Verify fitToView works**

1. Open app with several nodes scattered across the canvas.
2. In the browser console, temporarily call `window.__fitView?.()` — we'll wire the button in Task 6.
3. Alternatively proceed directly to Task 5 and test with the button.

**Step 6: Commit**

```bash
git add src/components/Canvas.js
git commit -m "feat: add zoomBehaviorRef and fitToView callback in Canvas"
```

---

## Task 5: Add auto-center on open to Canvas.js

**Files:**
- Modify: `src/components/Canvas.js`

**Context:** After mount, if there are existing nodes (loaded from localStorage), wait 500ms for the simulation to run a few ticks, then call `fitToView` once. The `hasAutoFitted` ref guards against repeat calls.

**Step 1: Add auto-fit useEffect**

Add this after the `fitToViewRef` update effect (from Task 4):

```js
// Auto-fit once on open when nodes exist
const hasAutoFitted = useRef(false);
useEffect(() => {
  if (hasAutoFitted.current || graphState.nodes.length === 0) return;
  hasAutoFitted.current = true;
  const timer = setTimeout(() => fitToViewRef.current(), 500);
  return () => clearTimeout(timer);
}, [graphState.nodes.length]); // re-check when node count changes (first load)
```

**Step 2: Verify visually**

1. Stop and restart the dev server.
2. If nodes exist in localStorage, the view should smoothly animate to fit them within ~500ms of page load.
3. If the canvas is empty, nothing should happen.

**Step 3: Commit**

```bash
git add src/components/Canvas.js
git commit -m "feat: auto-fit viewport on open when nodes exist"
```

---

## Task 6: Wire fitToView through App.js

**Files:**
- Modify: `src/App.js`

**Context:** App.js receives the `fitToView` function from Canvas via the `onFitReady` prop, stores it in a ref, and forwards it to Toolbar as `onFitView`.

**Step 1: Add fitViewFn ref in AppInner**

In `AppInner`, after `const canvasRef = useRef(null);`, add:
```js
const fitViewFn = useRef(null);
```

**Step 2: Pass onFitReady to Canvas**

In the `<Canvas ... />` JSX, add the prop:
```jsx
<Canvas
  connectMode={connectMode}
  physicsParams={physicsParams}
  onContextMenu={handleContextMenu}
  onFitReady={(fn) => { fitViewFn.current = fn; }}
/>
```

**Step 3: Pass onFitView to Toolbar**

In the `<Toolbar ... />` JSX, add the prop:
```jsx
<Toolbar
  connectMode={connectMode}
  physicsOpen={physicsOpen}
  onImport={() => setImportOpen(true)}
  onAddTheme={handleAddTheme}
  onAddCode={handleAddCode}
  onToggleConnect={() => setConnectMode(m => !m)}
  onExportPng={handleExportPng}
  onExportPdf={handleExportPdf}
  onTogglePhysics={() => setPhysicsOpen(o => !o)}
  onClear={handleClear}
  onFitView={() => fitViewFn.current?.()}
/>
```

**Step 4: Verify no console errors**

Check browser console — should be clean. The button won't work yet until Task 7 wires it in Toolbar.

**Step 5: Commit**

```bash
git add src/App.js
git commit -m "feat: wire fitToView from Canvas through App to Toolbar"
```

---

## Task 7: Add Fit View button to Toolbar.js

**Files:**
- Modify: `src/components/Toolbar.js`

**Context:** Add `onFitView` to Toolbar's props and add a `⊞ Fit View` button after the Connect button separator.

**Step 1: Update Toolbar props**

Change the function signature from:
```js
export default function Toolbar({ connectMode, physicsOpen, onImport, onAddTheme, onAddCode, onToggleConnect, onExportPng, onExportPdf, onTogglePhysics, onClear }) {
```
To:
```js
export default function Toolbar({ connectMode, physicsOpen, onImport, onAddTheme, onAddCode, onToggleConnect, onFitView, onExportPng, onExportPdf, onTogglePhysics, onClear }) {
```

**Step 2: Add the button**

After the Connect button block:
```jsx
<TbBtn onClick={onToggleConnect} active={connectMode}>
  {connectMode ? '✕ Cancel Connect' : '↔ Connect'}
</TbBtn>

<div className="w-px h-6 bg-slate-600 mx-1" />
```

Add the Fit View button **between** the Connect button and the next separator (before the export buttons):
```jsx
<TbBtn onClick={onToggleConnect} active={connectMode}>
  {connectMode ? '✕ Cancel Connect' : '↔ Connect'}
</TbBtn>
<TbBtn onClick={onFitView}>⊞ Fit View</TbBtn>

<div className="w-px h-6 bg-slate-600 mx-1" />
```

**Step 3: Full end-to-end verification**

1. Add several theme and code nodes.
2. Zoom in and pan around until nodes are out of view.
3. Click "⊞ Fit View" — expect a smooth 600ms animated zoom to fit all nodes.
4. Test with just 1 node — it should still fit.
5. Test with empty canvas — button should do nothing (no crash).
6. Enter connect mode, zoom in, click a code node — dashed line should follow mouse precisely.
7. Open Physics panel, drag Gravity slider up — nodes should pull inward. Drag down — they spread more loosely.
8. Reload the page with nodes in localStorage — view should auto-fit within ~500ms.

**Step 4: Commit**

```bash
git add src/components/Toolbar.js
git commit -m "feat: add Fit View button to Toolbar"
```

---

## Summary of Changes

| File | Tasks |
|------|-------|
| `src/utils/forceSimulation.js` | Task 1 |
| `src/components/PhysicsPanel.js` | Task 2 |
| `src/components/Canvas.js` | Tasks 3, 4, 5 |
| `src/App.js` | Task 6 |
| `src/components/Toolbar.js` | Task 7 |

## Success Criteria

- [ ] Connecting line tracks cursor precisely at any zoom/pan level
- [ ] "⊞ Fit View" button centers and scales all nodes into viewport with animation
- [ ] On reload with existing nodes, view auto-fits within ~500ms
- [ ] Nodes no longer drift excessively; gravity tunable in Physics panel
- [ ] All existing functionality (drag, context menu, edge creation, import/export) unchanged
