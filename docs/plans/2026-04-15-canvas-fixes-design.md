# Canvas Fixes & Enhancements — Design Doc
**Date:** 2026-04-15
**Scope:** `src/components/Canvas.js`, `src/components/Toolbar.js`, `src/App.js`, `src/utils/forceSimulation.js`, `src/components/PhysicsPanel.js`

---

## Problem Summary

Four issues make the canvas difficult to use:

1. **Connection line misalignment** — The dashed preview line drawn during edge-creation mode renders in the wrong coordinate space when the user has zoomed or panned. Root cause: `<g id="connecting-edge">` is conditionally rendered, so D3's zoom handler (`svg.selectAll('g').attr('transform', ...)`) never sets a transform on it when it first appears.

2. **No fit-to-viewport action** — Users have no way to re-center/re-scale the view after nodes drift or after importing a large graph.

3. **Nodes not centered on open** — On load, nodes from localStorage may not be visible because the initial zoom/pan is the identity transform, and node world-coordinates don't correspond to the visible viewport area.

4. **Nodes drift excessively** — The center force is `d3.forceCenter(...).strength(0.03)`, which only re-centers the center of mass rather than pulling individual nodes. Combined with `alphaDecay: 0.01` (slow cooling) and `repulsion: -300`, nodes drift far outward over time.

---

## Chosen Approach

**Approach A — Screen-space connecting line + gravity force + fit-to-view.**

---

## Design

### 1. Connection Line Fix (`Canvas.js`)

Remove the `<g id="connecting-edge"><line/></g>` block entirely. Replace with a bare `<line>` element rendered as a **direct child of `<svg>`** (no group wrapper, so no D3 zoom transform is applied).

Use screen-space coordinates for both endpoints:

```
Source (world → screen):
  sx = connectingFrom.x * k + tx
  sy = connectingFrom.y * k + ty

Target (already screen-space from mousemove handler):
  tx2 = tooltipPos.x - TOOLTIP_OFFSET   (= e.clientX - rect.left)
  ty2 = tooltipPos.y - TOOLTIP_OFFSET   (= e.clientY - rect.top)
```

`k`, `tx`, `ty` are read from `zoomTransformRef.current` at render time (synchronous ref, no lag).

**No other changes to the coordinate system.** Edges in `<g id="edges">` continue using world-space coords inside a D3-transformed group.

---

### 2. Fit to Viewport (`Canvas.js`, `App.js`, `Toolbar.js`)

#### Canvas changes
- Add `zoomBehaviorRef` (`useRef`) to store the D3 zoom behavior instance (currently only lives inside the setup `useEffect`).
- Inside the zoom setup `useEffect`, assign `zoomBehaviorRef.current = zoomBehavior`.
- Add `fitToView` (`useCallback`):
  1. Iterate all nodes, get their position from `positions.current` (falling back to `node.x/y`).
  2. Compute bounding box including node radii (65px for both node types at default size).
  3. Add 80px padding on all sides.
  4. Compute `scale = clamp(min(svgW / bboxW, svgH / bboxH), MIN_ZOOM, MAX_ZOOM)`.
  5. Compute `translate` to center the bounding box in the SVG.
  6. Apply via `d3.select(svgRef.current).transition().duration(600).call(zoomBehaviorRef.current.transform, newTransform)`.
- Accept optional `onFitReady` prop. Call `onFitReady(fitToView)` once on mount via `useEffect`.

#### App.js changes
- Add `fitViewFn` ref.
- Pass `onFitReady={(fn) => { fitViewFn.current = fn; }}` to Canvas.
- Pass `onFitView={() => fitViewFn.current?.()}` to Toolbar.

#### Toolbar.js changes
- Accept `onFitView` prop.
- Add `⊞ Fit View` button in the toolbar (after the Connect separator).

---

### 3. Center on Open (`Canvas.js`)

```js
const hasAutoFitted = useRef(false);

useEffect(() => {
  if (hasAutoFitted.current || graphState.nodes.length === 0) return;
  hasAutoFitted.current = true;
  const timer = setTimeout(fitToView, 500); // let simulation settle
  return () => clearTimeout(timer);
}, [graphState.nodes.length, fitToView]);
```

The ref guard ensures this fires exactly once per session. If the canvas is empty on open, it does nothing. When nodes are later added, the user uses the Fit View button manually.

---

### 4. Gravity Force (`forceSimulation.js`, `PhysicsPanel.js`)

#### forceSimulation.js changes
- Add `gravity: 0.08` to `DEFAULT_PHYSICS`.
- Replace `.force('center', d3.forceCenter(...).strength(0.03))` with:
  ```js
  .force('x', d3.forceX(cx).strength(params.gravity))
  .force('y', d3.forceY(cy).strength(params.gravity))
  ```
  where `cx/cy` is the simulation center (passed in, defaults to `window.innerWidth/2`, `window.innerHeight/2`).
- In `updateParams`: update `sim.force('x')?.strength(...)` and `sim.force('y')?.strength(...)`.

#### PhysicsPanel.js changes
- Add a "Gravity" slider (range 0.01–0.2, step 0.01, default 0.08).
- Wire to `params.gravity` / `onChange`.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/Canvas.js` | Fix connecting line coords; add `zoomBehaviorRef`; add `fitToView`; add auto-fit on open; accept `onFitReady` prop |
| `src/App.js` | Store `fitViewFn` ref; wire `onFitReady` + `onFitView` |
| `src/components/Toolbar.js` | Add `onFitView` prop + Fit View button |
| `src/utils/forceSimulation.js` | Add `gravity` param; replace `forceCenter` with `forceX`/`forceY` |
| `src/components/PhysicsPanel.js` | Add Gravity slider |

---

## Success Criteria

- [ ] Connecting line tracks the mouse cursor precisely at any zoom/pan level
- [ ] "Fit View" button centers and scales all nodes into the viewport
- [ ] On app open with existing nodes, the view auto-fits within ~500ms
- [ ] Nodes no longer drift to the edges of the graph; gravity pull is visible but not jarring
- [ ] Gravity can be tuned via PhysicsPanel slider
