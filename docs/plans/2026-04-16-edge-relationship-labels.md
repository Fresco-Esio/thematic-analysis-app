# Edge Relationship Labels Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Add labeled, typed connections between code and theme nodes with distinct SVG dash patterns and a floating Neo-Brutalist panel for editing.

**Architecture:** Edge data gains `relationType` and `label` fields (backward-compatible, null by default). A new `EdgeRelationshipPanel` component floats near the edge midpoint when triggered from the right-click context menu. Canvas edge rendering reads the type map to apply `strokeDasharray` and renders a midpoint `<text>` label.

**Tech Stack:** React 19, D3 v7 SVG, Tailwind CSS 3, existing GraphContext reducer pattern, Jest + @testing-library/react for unit tests, Playwright for E2E.

---

## Task 1: Edge type constants

**Files:**
- Create: `src/utils/edgeTypes.js`
- Test: `src/utils/edgeTypes.test.js`

**Step 1: Write failing test**

Create `src/utils/edgeTypes.test.js`:

```js
import { EDGE_TYPES, getEdgeDashArray, getEdgeStrokeWidth } from './edgeTypes';

test('EDGE_TYPES has exactly 6 preset entries', () => {
  expect(Object.keys(EDGE_TYPES)).toHaveLength(6);
});

test('each EDGE_TYPES entry has label and dashArray', () => {
  Object.values(EDGE_TYPES).forEach(t => {
    expect(t).toHaveProperty('label');
    expect(t).toHaveProperty('dashArray');
  });
});

test('getEdgeDashArray returns empty string for null type', () => {
  expect(getEdgeDashArray(null)).toBe('');
});

test('getEdgeDashArray returns correct pattern for known type', () => {
  expect(getEdgeDashArray('supports')).toBe('');
  expect(getEdgeDashArray('elaborates')).toBe('10,5');
});

test('getEdgeStrokeWidth returns 2 for null type, 3.5 for known type', () => {
  expect(getEdgeStrokeWidth(null)).toBe(2);
  expect(getEdgeStrokeWidth('supports')).toBe(3.5);
});
```

**Step 2: Run to verify it fails**

```bash
cd D:\thematic-analysis-app && npm test -- --testPathPattern=edgeTypes --watchAll=false
```

Expected: FAIL — module not found.

**Step 3: Implement**

Create `src/utils/edgeTypes.js`:

```js
/**
 * edgeTypes.js
 * ─────────────────────────────────────────────────────────────────────────
 * Preset relationship types for edges between code and theme nodes.
 * Each type has a display label and an SVG strokeDasharray pattern.
 * Solid lines (supports) use an empty string — browser default is solid.
 */

export const EDGE_TYPES = {
  supports:       { label: 'supports',       dashArray: '' },
  elaborates:     { label: 'elaborates',     dashArray: '10,5' },
  contradicts:    { label: 'contradicts',    dashArray: '5,5' },
  exemplifies:    { label: 'exemplifies',    dashArray: '2,6' },
  contextualises: { label: 'contextualises', dashArray: '16,5' },
  questions:      { label: 'questions',      dashArray: '5,10' },
};

/** Returns the strokeDasharray string for a given relationType key, or '' for solid. */
export function getEdgeDashArray(relationType) {
  if (!relationType || !EDGE_TYPES[relationType]) return '';
  return EDGE_TYPES[relationType].dashArray;
}

/** Returns stroke width: 3.5px for typed edges, 2px for unlabeled. */
export function getEdgeStrokeWidth(relationType) {
  return relationType && EDGE_TYPES[relationType] ? 3.5 : 2;
}
```

**Step 4: Run test to verify pass**

```bash
npm test -- --testPathPattern=edgeTypes --watchAll=false
```

Expected: PASS (5 tests).

**Step 5: Commit**

```bash
git add src/utils/edgeTypes.js src/utils/edgeTypes.test.js
git commit -m "feat: add edge type constants and helpers"
```

---

## Task 2: UPDATE_EDGE reducer action

**Files:**
- Modify: `src/context/GraphContext.js` — add `UPDATE_EDGE` case
- Test: `src/context/GraphContext.test.js` (existing file — add tests)

**Step 1: Write failing test**

Open `src/context/GraphContext.test.js` and add at the end:

```js
import { graphReducer } from './GraphContext';

describe('UPDATE_EDGE', () => {
  const baseState = {
    nodes: [],
    edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
  };

  test('updates relationType and label on the matching edge', () => {
    const next = graphReducer(baseState, {
      type: 'UPDATE_EDGE',
      id: 'e1',
      changes: { relationType: 'supports', label: 'supports' },
    });
    expect(next.edges[0]).toMatchObject({ id: 'e1', relationType: 'supports', label: 'supports' });
  });

  test('does not mutate other edges', () => {
    const state = {
      nodes: [],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
      ],
    };
    const next = graphReducer(state, {
      type: 'UPDATE_EDGE', id: 'e1', changes: { relationType: 'contradicts', label: 'contradicts' },
    });
    expect(next.edges[1]).toEqual({ id: 'e2', source: 'n2', target: 'n3' });
  });

  test('returns state unchanged for unknown id', () => {
    const next = graphReducer(baseState, {
      type: 'UPDATE_EDGE', id: 'nonexistent', changes: { relationType: 'supports' },
    });
    expect(next).toBe(baseState);
  });
});
```

**Step 2: Run to verify it fails**

```bash
npm test -- --testPathPattern=GraphContext --watchAll=false
```

Expected: FAIL — "UPDATE_EDGE is not handled".

**Step 3: Implement**

In `src/context/GraphContext.js`, add after the `DELETE_EDGE` case (around line 174), before `SET_GRAPH`:

```js
case 'UPDATE_EDGE': {
  const exists = state.edges.some(e => e.id === action.id);
  if (!exists) return state;
  return {
    ...state,
    edges: state.edges.map(e =>
      e.id === action.id ? { ...e, ...action.changes } : e
    ),
  };
}
```

Also update the JSDoc comment at the top of the file — add to the ACTIONS list:
```
 *   UPDATE_EDGE   { id, changes: Partial<Edge> }
```

**Step 4: Run test to verify pass**

```bash
npm test -- --testPathPattern=GraphContext --watchAll=false
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/context/GraphContext.js src/context/GraphContext.test.js
git commit -m "feat: add UPDATE_EDGE reducer action"
```

---

## Task 3: EdgeRelationshipPanel component

**Files:**
- Create: `src/components/EdgeRelationshipPanel.js`

This is a floating, draggable panel. No unit test needed — behavior is visual and interaction-driven; E2E covers it in Task 5.

**Step 1: Create the component**

```jsx
/**
 * EdgeRelationshipPanel.js
 * ────────────────────────────────────────────────────────────────────────
 * A floating, draggable panel for setting the relationship type and label
 * on an edge. Appears anchored near the edge midpoint.
 *
 * PROPS:
 *   edge       {object|null}  — the edge being edited (null = hidden)
 *   anchorX    {number}       — screen-space X to anchor near
 *   anchorY    {number}       — screen-space Y to anchor near
 *   onClose    {fn}           — called when panel should dismiss
 *   onApply    {fn(relationType, label)} — called when user confirms selection
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EDGE_TYPES } from '../utils/edgeTypes';

const PANEL_WIDTH  = 232;
const PANEL_OFFSET = 16; // px from anchor point

export default function EdgeRelationshipPanel({ edge, anchorX, anchorY, onClose, onApply }) {
  const panelRef     = useRef(null);
  const dragOffset   = useRef(null);

  const [selectedType, setSelectedType] = useState(null);
  const [customLabel,  setCustomLabel]  = useState('');
  const [pos, setPos] = useState({ x: 0, y: 0 });

  // Sync state when edge changes
  useEffect(() => {
    if (!edge) return;
    setSelectedType(edge.relationType ?? null);
    setCustomLabel(
      edge.relationType ? '' : (edge.label ?? '')
    );
  }, [edge?.id]); // eslint-disable-line

  // Position panel near anchor, clamped to viewport
  useEffect(() => {
    if (!edge) return;
    const panelH = 260; // approx
    const x = Math.min(anchorX + PANEL_OFFSET, window.innerWidth  - PANEL_WIDTH - 8);
    const y = Math.min(anchorY + PANEL_OFFSET, window.innerHeight - panelH      - 8);
    setPos({ x: Math.max(8, x), y: Math.max(8, y) });
  }, [edge?.id, anchorX, anchorY]); // eslint-disable-line

  // Dismiss on Escape
  useEffect(() => {
    if (!edge) return;
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [edge, onClose]);

  // Dismiss on outside click
  useEffect(() => {
    if (!edge) return;
    function onDown(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [edge, onClose]);

  // ── Drag ──────────────────────────────────────────────────────────────────
  const handleGripMouseDown = useCallback((e) => {
    e.preventDefault();
    dragOffset.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };

    function onMove(me) {
      setPos({
        x: Math.max(0, me.clientX - dragOffset.current.dx),
        y: Math.max(0, me.clientY - dragOffset.current.dy),
      });
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [pos]);

  // ── Selection logic ───────────────────────────────────────────────────────
  function handlePresetClick(typeKey) {
    const newType = selectedType === typeKey ? null : typeKey;
    setSelectedType(newType);
    setCustomLabel('');
    onApply(newType, newType ? EDGE_TYPES[typeKey].label : null);
  }

  function handleCustomChange(e) {
    setSelectedType(null);
    setCustomLabel(e.target.value);
  }

  function handleCustomApply() {
    const trimmed = customLabel.trim();
    onApply(null, trimmed || null);
  }

  function handleCustomKeyDown(e) {
    if (e.key === 'Enter') handleCustomApply();
  }

  if (!edge) return null;

  return (
    <div
      ref={panelRef}
      style={{
        position:    'fixed',
        left:        pos.x,
        top:         pos.y,
        width:       PANEL_WIDTH,
        zIndex:      600,
        background:  '#f0ebe3',
        border:      '2px solid #0f0d0a',
        boxShadow:   '4px 4px 0 #0f0d0a',
        fontFamily:  '"Bricolage Grotesque", sans-serif',
      }}
    >
      {/* Grip + title + close */}
      <div
        onMouseDown={handleGripMouseDown}
        style={{
          background:  '#0f0d0a',
          cursor:      'grab',
          padding:     '6px 10px',
          display:     'flex',
          alignItems:  'center',
          justifyContent: 'space-between',
          userSelect:  'none',
        }}
      >
        <span style={{ color: '#f0ebe3', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>
          ··· RELATIONSHIP
        </span>
        <button
          onClick={onClose}
          aria-label="Close relationship panel"
          style={{
            background: 'none', border: 'none', color: '#f0ebe3',
            fontSize: 14, fontWeight: 700, cursor: 'pointer', lineHeight: 1, padding: 0,
          }}
        >✕</button>
      </div>

      {/* Preset chips */}
      <div style={{ padding: '10px 10px 6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {Object.entries(EDGE_TYPES).map(([key, { label, dashArray }]) => {
          const isSelected = selectedType === key;
          return (
            <button
              key={key}
              onClick={() => handlePresetClick(key)}
              title={label}
              style={{
                display:      'flex',
                flexDirection:'column',
                alignItems:   'center',
                gap:          4,
                padding:      '6px 4px',
                border:       `1.5px solid #0f0d0a`,
                background:   isSelected ? '#0f0d0a' : 'transparent',
                boxShadow:    isSelected ? '2px 2px 0 #dc2626' : 'none',
                cursor:       'pointer',
                color:        isSelected ? '#f0ebe3' : '#0f0d0a',
                fontSize:     11,
                fontWeight:   700,
                fontFamily:   'inherit',
                transition:   'background 100ms, box-shadow 100ms',
              }}
            >
              {/* Mini line preview */}
              <svg width="40" height="10" style={{ display: 'block' }}>
                <line
                  x1="2" y1="5" x2="38" y2="5"
                  stroke={isSelected ? '#f0ebe3' : '#0f0d0a'}
                  strokeWidth="3.5"
                  strokeDasharray={dashArray || undefined}
                  strokeLinecap="round"
                />
              </svg>
              {label}
            </button>
          );
        })}
      </div>

      {/* Custom label input */}
      <div style={{ padding: '4px 10px 12px' }}>
        <input
          type="text"
          value={customLabel}
          onChange={handleCustomChange}
          onBlur={handleCustomApply}
          onKeyDown={handleCustomKeyDown}
          placeholder="custom label…"
          style={{
            width:       '100%',
            background:  'transparent',
            border:      'none',
            borderBottom:'2px solid #0f0d0a',
            outline:     'none',
            fontSize:    13,
            fontWeight:  700,
            fontFamily:  'inherit',
            color:       '#0f0d0a',
            padding:     '4px 0',
            boxSizing:   'border-box',
          }}
        />
      </div>
    </div>
  );
}
```

**Step 2: Verify it compiles**

```bash
npm start
```

Open the app in the browser and confirm there are no console errors. The panel is not yet wired up — that happens in Tasks 4 and 5.

**Step 3: Commit**

```bash
git add src/components/EdgeRelationshipPanel.js
git commit -m "feat: add EdgeRelationshipPanel floating component"
```

---

## Task 4: Wire panel into App.js + context menu

**Files:**
- Modify: `src/App.js`

**Step 1: Add edgeEditId state and panel anchor state**

In `AppInner`, add two new state variables after the existing modal state (around line 48):

```js
const [edgeEditId,     setEdgeEditId]     = useState(null);
const [edgePanelAnchor, setEdgePanelAnchor] = useState({ x: 0, y: 0 });
```

**Step 2: Add import**

At the top of `App.js`, add:

```js
import EdgeRelationshipPanel from './components/EdgeRelationshipPanel';
```

Also import `UPDATE_EDGE` — it's dispatched via the existing `dispatch` from `useGraphDispatch`, no new import needed.

**Step 3: Update edge context menu item**

In `handleContextMenu`, replace the `'edge'` branch:

```js
} else if (type === 'edge') {
  items = [
    {
      label: '✎ Edit Relationship',
      action: () => {
        setEdgeEditId(id);
        setEdgePanelAnchor({ x, y });
      },
    },
    { label: '✕ Remove Connection', action: () => dispatch({ type: 'DELETE_EDGE', id }), danger: true },
  ];
}
```

**Step 4: Add onApply handler**

In `AppInner`, add:

```js
function handleEdgeRelationshipApply(relationType, label) {
  if (!edgeEditId) return;
  dispatch({ type: 'UPDATE_EDGE', id: edgeEditId, changes: { relationType, label } });
}
```

**Step 5: Render the panel**

In the JSX return, after the `<ThemeEditModal>` line (around line 238), add:

```jsx
<EdgeRelationshipPanel
  edge={edges.find(e => e.id === edgeEditId) ?? null}
  anchorX={edgePanelAnchor.x}
  anchorY={edgePanelAnchor.y}
  onClose={() => setEdgeEditId(null)}
  onApply={handleEdgeRelationshipApply}
/>
```

**Step 6: Smoke-test manually**

1. `npm start`
2. Add a theme and two code nodes
3. Connect a code to the theme (connect mode)
4. Right-click the edge → confirm "✎ Edit Relationship" appears
5. Click it → confirm the floating panel appears near the click
6. Click "supports" → confirm the chip highlights. Panel stays open for further edits.
7. Press Escape → panel closes
8. Right-click edge again → click "✕ Remove Connection" → confirm edge is deleted

**Step 7: Commit**

```bash
git add src/App.js
git commit -m "feat: wire EdgeRelationshipPanel into App and context menu"
```

---

## Task 5: Update Canvas edge rendering

**Files:**
- Modify: `src/components/Canvas.js`

This task makes edges visually reflect their type: dash pattern + midpoint label.

**Step 1: Add imports**

At the top of `Canvas.js`, add:

```js
import { getEdgeDashArray, getEdgeStrokeWidth } from '../utils/edgeTypes';
```

**Step 2: Replace the edge `<line>` render**

Find the `edgeListMemo.map(...)` block (around line 538). Replace the `<line>` element with a `<g>` containing the line and a conditional midpoint label:

```jsx
{edgeListMemo.map(({ edge, sourceNode, targetNode }) => {
  const { x: x1, y: y1 } = getNodePos(sourceNode.id);
  const { x: x2, y: y2 } = getNodePos(targetNode.id);

  const isActive    = canvasState.activeEdgeId === edge.id;
  const strokeColor = edge.color || (targetNode.color || '#64748b');
  const dashArray   = getEdgeDashArray(edge.relationType);
  const strokeWidth = isActive ? 5 : getEdgeStrokeWidth(edge.relationType);

  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const hasLabel = !!edge.label;

  // Approximate label width for background rect
  const labelChars  = (edge.label || '').length;
  const labelWidth  = labelChars * 6.5 + 8;
  const labelHeight = 16;

  return (
    <g key={edge.id}>
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={dashArray || undefined}
        strokeLinecap="round"
        opacity={isActive ? 1 : 0.6}
        style={{ cursor: 'pointer', transition: 'stroke-width 150ms ease, opacity 150ms ease' }}
        onMouseEnter={() => handleEdgeMouseEnter(edge.id)}
        onMouseLeave={() => handleEdgeMouseLeave()}
        onClick={(e) => handleEdgeClick(edge.id, e)}
      />
      {hasLabel && (
        <g
          style={{ pointerEvents: 'none' }}
          onMouseEnter={() => handleEdgeMouseEnter(edge.id)}
          onMouseLeave={() => handleEdgeMouseLeave()}
        >
          <rect
            x={mx - labelWidth / 2}
            y={my - labelHeight / 2}
            width={labelWidth}
            height={labelHeight}
            fill="#f0ebe3"
            rx={0}
          />
          <text
            x={mx}
            y={my + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={strokeColor}
            fontSize={10}
            fontWeight={700}
            fontFamily='"Bricolage Grotesque", sans-serif'
            style={{
              textDecoration: isActive ? 'underline' : 'none',
              textDecorationColor: '#dc2626',
            }}
          >
            {edge.label}
          </text>
        </g>
      )}
    </g>
  );
})}
```

**Step 3: Smoke-test visually**

1. `npm start`
2. Add theme + code nodes, connect them
3. Right-click edge → "✎ Edit Relationship" → select "contradicts"
4. Confirm: edge becomes dashed (`5,5`), midpoint label "contradicts" appears
5. Select "supports" → edge becomes solid, label updates to "supports"
6. Type a custom label "key example" → Enter → label updates, no dash pattern applied
7. Zoom in/out — confirm label stays at midpoint and scales with zoom

**Step 4: Commit**

```bash
git add src/components/Canvas.js
git commit -m "feat: render edge dash patterns and midpoint labels by relationship type"
```

---

## Task 6: E2E test for edge relationship panel

**Files:**
- Modify: `e2e/app.spec.js`

**Step 1: Add the test**

Open `e2e/app.spec.js` and add a new `test` block at the end:

```js
test('edge relationship panel opens, sets type, and reflects on canvas', async ({ page }) => {
  // Setup: add theme and code, connect them
  await page.getByRole('button', { name: /Add Theme/i }).click();
  await page.getByRole('button', { name: /Add Code/i }).click();

  // Enter connect mode
  await page.getByRole('button', { name: /connect/i }).click();

  // Click code node then theme node to create edge
  const codeNode  = page.locator('[data-node-type="code"]').first();
  const themeNode = page.locator('[data-node-type="theme"]').first();
  await codeNode.click();
  await themeNode.click();

  // Right-click the SVG edge (click midpoint region of SVG)
  const svg    = page.locator('#canvas-svg');
  const svgBox = await svg.boundingBox();
  await page.mouse.click(svgBox.x + svgBox.width / 2, svgBox.y + svgBox.height / 2, { button: 'right' });

  // Click "Edit Relationship" in context menu
  await page.getByRole('menuitem', { name: /Edit Relationship/i }).click();

  // Panel should be visible
  await expect(page.getByText('RELATIONSHIP')).toBeVisible();

  // Click the "supports" preset chip
  await page.getByRole('button', { name: /supports/i }).first().click();

  // Close with Escape
  await page.keyboard.press('Escape');

  // Panel should be gone
  await expect(page.getByText('RELATIONSHIP')).not.toBeVisible();
});
```

**Note:** The node click-to-connect in E2E requires `data-node-type` attributes on GraphNode. If they are not present, skip the connection creation part and test only the panel open/close via a direct `handleContextMenu` call pattern — or add the data attributes in Task 6b below.

**Step 2: Add data-node-type attributes to GraphNode**

Open `src/components/nodes/GraphNode.js`. Find the outermost `motion.div` and add:

```jsx
data-node-type={node.type}
```

**Step 3: Run E2E**

```bash
npx playwright test --reporter=list
```

Expected: All 13 existing tests PASS + 1 new test PASS (14 total).

If the new test is flaky due to edge click detection on thin SVG lines, adjust: right-click at the SVG center, or skip the E2E and rely on manual smoke test from Task 5.

**Step 4: Commit**

```bash
git add e2e/app.spec.js src/components/nodes/GraphNode.js
git commit -m "test: add E2E test for edge relationship panel"
```

---

## Task 7: Run full test suite and verify

**Step 1: Unit tests**

```bash
npm test -- --watchAll=false
```

Expected: All tests PASS (original 4 + new edgeTypes + UPDATE_EDGE tests).

**Step 2: E2E tests**

```bash
npx playwright test --reporter=list
```

Expected: All tests PASS.

**Step 3: Build check**

```bash
npm run build
```

Expected: Clean build, no errors.

**Step 4: Final commit if needed**

```bash
git add -A
git commit -m "chore: final cleanup after edge relationship labels feature"
```
