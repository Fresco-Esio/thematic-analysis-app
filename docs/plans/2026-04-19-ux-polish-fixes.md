# UX Polish Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Add 6 targeted UX polish features that improve usability and discoverability without changing the application architecture.

**Architecture:** All fixes leverage existing patterns — modal dispatch actions, reducer updates, inline event handlers, and Tailwind/inline styling. No new components or contexts are added.

**Tech Stack:** React 19, D3 v7, Framer Motion 12, Tailwind CSS 3, useReducer + Context.

---

## Task 1: Double-Click to Open Edit Modal on Any Node

**Files:**
- Modify: `src/components/nodes/GraphNode.js:34-255`
- Modify: `src/App.js` (add double-click handler prop and dispatch logic)

**Step 1: Add double-click handler to GraphNode**

In `GraphNode.js`, add a double-click handler alongside the existing `onClick`:

```javascript
const handleDoubleClick = useCallback((e) => {
  e.stopPropagation(); // prevent canvas interaction
  // Call parent handler if provided
  if (onDoubleClick) onDoubleClick(e);
}, [onDoubleClick]);
```

Add `onDoubleClick` to the motion.div:

```javascript
onDoubleClick={handleDoubleClick}
```

Add `onDoubleClick = () => {}` to the function signature props (line 54).

**Step 2: Add onNodeDoubleClick handler to App.js**

In `App.js`, add a new handler function:

```javascript
const handleNodeDoubleClick = useCallback((nodeId) => {
  const node = graphState.nodes.find(n => n.id === nodeId);
  if (!node) return;
  
  if (node.type === 'code') {
    setCodeEditId(nodeId);
  } else if (node.type === 'theme') {
    setThemeEditId(nodeId);
  } else if (node.type === 'subtheme') {
    setCodeEditId(nodeId); // treat subtheme like code for editing
  }
}, [graphState.nodes]);
```

Pass this handler to Canvas: `onNodeDoubleClick={handleNodeDoubleClick}`

**Step 3: Wire Canvas to GraphNode**

In `Canvas.js`, pass the handler to GraphNode component where it's rendered:

```javascript
onDoubleClick={() => onNodeDoubleClick(node.id)}
```

**Step 4: Test double-click behavior**

Run E2E test to verify:
```bash
npx playwright test --grep="double-click"
```

Expected: Clicking a theme node twice opens ThemeEditModal; clicking code node twice opens CodeEditModal.

**Step 5: Commit**

```bash
git add src/components/nodes/GraphNode.js src/components/Canvas.js src/App.js
git commit -m "feat: add double-click to open edit modal on any node"
```

---

## Task 2: Auto-Number New Nodes on Creation

**Files:**
- Modify: `src/App.js` (handleAddTheme, handleAddCode functions)
- Modify: `src/utils/nodeUtils.js` (add helper function)

**Step 1: Add counter helper to nodeUtils.js**

Add a function to count existing nodes of a type:

```javascript
export function getNextNodeNumber(nodes, nodeType) {
  const nodesOfType = nodes.filter(n => n.type === nodeType);
  // Extract numbers from labels like "Theme 1", "Theme 2"
  const numbers = nodesOfType
    .map(n => {
      const match = n.label.match(/^(Theme|Code|Subtheme)\s+(\d+)$/);
      return match ? parseInt(match[2], 10) : 0;
    })
    .filter(num => num > 0);
  
  return Math.max(0, ...numbers) + 1;
}
```

**Step 2: Update handleAddTheme in App.js**

Replace the hardcoded 'New Theme' label:

```javascript
const handleAddTheme = useCallback(() => {
  const nextNum = getNextNodeNumber(graphState.nodes, 'theme');
  const newNode = {
    id: makeId('theme'),
    type: 'theme',
    label: `Theme ${nextNum}`,
    color: THEME_PALETTE[graphState.nodes.filter(n => n.type === 'theme').length % THEME_PALETTE.length],
    x: 0,
    y: 0,
  };
  dispatch({ type: 'ADD_NODE', node: newNode });
  setThemeEditId(newNode.id); // auto-open for renaming
}, [graphState.nodes]);
```

Import the helper:
```javascript
import { getNextNodeNumber } from '../utils/nodeUtils';
```

**Step 3: Update handleAddCode in App.js**

Similarly update handleAddCode:

```javascript
const handleAddCode = useCallback(() => {
  const nextNum = getNextNodeNumber(graphState.nodes, 'code');
  const newNode = {
    id: makeId('code'),
    type: 'code',
    label: `Code ${nextNum}`,
    quote: '',
    source: '',
    primaryThemeId: null,
    color: UNASSIGNED_COLOR,
    x: 0,
    y: 0,
  };
  dispatch({ type: 'ADD_NODE', node: newNode });
  setCodeEditId(newNode.id); // auto-open for editing
}, [graphState.nodes]);
```

**Step 4: Update handleAddSubtheme (if exists in App.js)**

Similar pattern for subthemes:

```javascript
const nextNum = getNextNodeNumber(graphState.nodes, 'subtheme');
label: `Subtheme ${nextNum}`,
```

**Step 5: Test auto-numbering**

Create nodes in sequence and verify numbering:
```bash
npm test -- nodeUtils.test.js
```

Expected: Creating 3 themes results in labels "Theme 1", "Theme 2", "Theme 3".

**Step 6: Commit**

```bash
git add src/App.js src/utils/nodeUtils.js
git commit -m "feat: auto-number new nodes on creation (Theme 1, Code 1, etc)"
```

---

## Task 3: Empty-State Overlay When Canvas Has No Nodes

**Files:**
- Modify: `src/components/Canvas.js` (add empty state JSX)
- Modify: `src/App.js` (pass empty state indicator)

**Step 1: Add empty-state overlay in Canvas.js**

After the SVG edges render and before the React node layer, add:

```javascript
{nodes.length === 0 && (
  <div
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(15, 13, 10, 0.3)',
      backdropFilter: 'blur(2px)',
      pointerEvents: 'none',
      zIndex: 5,
    }}
  >
    <div
      style={{
        textAlign: 'center',
        padding: '2rem',
        backgroundColor: '#f0ebe3',
        border: '3px solid #0f0d0a',
        borderRadius: '8px',
        boxShadow: '6px 6px 0 #0f0d0a',
        maxWidth: '400px',
      }}
    >
      <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f0d0a', marginBottom: '0.5rem' }}>
        Canvas is empty
      </p>
      <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: '1.6' }}>
        Use the toolbar to import data or start creating themes and codes.
      </p>
    </div>
  </div>
)}
```

**Step 2: Style with Neo-Brutalist theme**

Ensure the overlay uses the design system:
- Background: `#f0ebe3` (cream)
- Border: `3px solid #0f0d0a` (near-black)
- Shadow: `6px 6px 0 #0f0d0a` (hard offset)
- Font: Bricolage Grotesque or system fallback

**Step 3: Test empty state**

1. Clear graph (click "✕ Clear" button)
2. Verify overlay appears with centered text
3. Verify overlay disappears when first node is added

```bash
npm test -- Canvas.test.js
```

**Step 4: Commit**

```bash
git add src/components/Canvas.js
git commit -m "feat: add empty-state overlay when canvas has no nodes"
```

---

## Task 4: Connect Mode Active Button State and Canvas Hint Text

**Files:**
- Modify: `src/components/Toolbar.js` (enhance Connect button styling)
- Modify: `src/components/Canvas.js` (add hint text overlay)

**Step 1: Enhance Connect button active state in Toolbar.js**

The Connect button already has `active={connectMode}` on line 86, which applies the active style. Enhance the button text to provide clearer feedback:

```javascript
<TbBtn onClick={onToggleConnect} active={connectMode} aria-pressed={connectMode}>
  {connectMode ? '✕ Cancel Connect' : '↔ Connect'}
</TbBtn>
```

This is already present, but ensure TbBtn's secondary active style clearly shows:
```javascript
active: connectMode
  ? 'bg-white text-[#dc2626] border-[#dc2626]'  // bright white+red when active
  : 'bg-transparent text-white border-white hover:bg-white hover:text-[#0f0d0a]',
```

**Step 2: Add Canvas hint text in Canvas.js**

When `connectMode` is true, display a hint overlay:

```javascript
{connectMode && (
  <div
    style={{
      position: 'absolute',
      top: '1rem',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#dc2626',
      color: 'white',
      padding: '0.75rem 1.5rem',
      borderRadius: '4px',
      border: '2px solid #0f0d0a',
      fontSize: '14px',
      fontWeight: 'bold',
      boxShadow: '3px 3px 0 #0f0d0a',
      zIndex: 100,
      pointerEvents: 'none',
    }}
  >
    Click a code or subtheme, then a theme to connect
  </div>
)}
```

Add `connectMode` to Canvas props: `function Canvas({ ..., connectMode, ... })`

Pass from App.js: `<Canvas ... connectMode={connectMode} ... />`

**Step 3: Test visual feedback**

1. Click "↔ Connect" button — verify it turns white with red text and red border
2. Hint text appears at top of canvas
3. Click "✕ Cancel Connect" — verify button returns to transparent state and hint disappears

```bash
npm test -- Toolbar.test.js
```

**Step 4: Commit**

```bash
git add src/components/Toolbar.js src/components/Canvas.js src/App.js
git commit -m "feat: enhance Connect mode button state and add canvas hint text"
```

---

## Task 5: Cursor Styling — Default on Canvas Background, Grab on Nodes

**Files:**
- Modify: `src/components/Canvas.js` (canvas cursor)
- Modify: `src/components/nodes/GraphNode.js` (node cursor)

**Step 1: Set canvas background cursor in Canvas.js**

Find the main canvas SVG container element and set cursor to default:

```javascript
<svg
  ref={svgRef}
  style={{
    position: 'absolute',
    width: '100%',
    height: '100%',
    cursor: 'default',  // ← add this
    touchAction: 'none',
  }}
>
```

**Step 2: Verify node cursor in GraphNode.js**

GraphNode already has `cursor: connectMode ? 'crosshair' : 'grab'` on line 166.

Verify it's in the style object:

```javascript
style={{
  ...
  cursor: connectMode ? 'crosshair' : 'grab',
  ...
}}
```

This is already correct. No changes needed.

**Step 3: Test cursor behavior**

1. Open app — cursor is default (arrow)
2. Hover over canvas background — cursor remains default
3. Hover over any node — cursor changes to grab (or crosshair if in connect mode)
4. Press Escape to exit connect mode — cursor on nodes returns to grab

Manual test in browser:
```bash
npm start
```

**Step 4: Commit**

```bash
git add src/components/Canvas.js
git commit -m "feat: set cursor to default on canvas, grab on nodes"
```

---

## Task 6: Human-Readable Physics Slider Labels

**Files:**
- Modify: `src/components/PhysicsPanel.js` (update slider label rendering)

**Step 1: Review current slider configuration**

In `PhysicsPanel.js`, the SLIDERS array defines each slider with properties including a `label` field and optional `unit` and `transform` functions.

Current structure (lines ~40-60):

```javascript
const SLIDERS = [
  { key: 'linkDistance', label: 'Link Distance', min: 60, max: 400, unit: 'px' },
  { key: 'repulsion', label: 'Repulsion', min: -600, max: -50, unit: undefined, transform: (v) => v },
  { key: 'collisionRadius', label: 'Collision Radius', min: 30, max: 180, unit: 'px' },
  { key: 'linkStrength', label: 'Link Strength', min: 0, max: 1, unit: '%', transform: (v) => (v * 100).toFixed(0) },
  { key: 'velocityDecay', label: 'Velocity Decay', min: 0, max: 1, unit: '%', transform: (v) => (v * 100).toFixed(0) },
  { key: 'gravity', label: 'Gravity / Center Pull', min: 0, max: 15, unit: undefined },
];
```

**Step 2: Enhance labels with descriptions**

Update SLIDERS to include tooltip-style description text:

```javascript
const SLIDERS = [
  { 
    key: 'linkDistance', 
    label: 'Link Distance', 
    description: 'Spacing between connected nodes',
    min: 60, 
    max: 400, 
    unit: 'px' 
  },
  { 
    key: 'repulsion', 
    label: 'Repulsion', 
    description: 'Push nodes apart (stronger = more negative)',
    min: -600, 
    max: -50, 
    unit: undefined, 
    transform: (v) => v 
  },
  { 
    key: 'collisionRadius', 
    label: 'Collision Radius', 
    description: 'Collision detection range around nodes',
    min: 30, 
    max: 180, 
    unit: 'px' 
  },
  { 
    key: 'linkStrength', 
    label: 'Link Strength', 
    description: 'How tightly edges pull nodes together',
    min: 0, 
    max: 1, 
    unit: '%', 
    transform: (v) => (v * 100).toFixed(0) 
  },
  { 
    key: 'velocityDecay', 
    label: 'Velocity Decay', 
    description: 'How quickly motion slows down',
    min: 0, 
    max: 1, 
    unit: '%', 
    transform: (v) => (v * 100).toFixed(0) 
  },
  { 
    key: 'gravity', 
    label: 'Gravity / Center Pull', 
    description: 'Pull all nodes toward the center',
    min: 0, 
    max: 15, 
    unit: undefined 
  },
];
```

**Step 3: Render descriptions in the UI**

Find the slider rendering JSX in PhysicsPanel. Locate where the label is rendered (around line 100-120) and add a description:

```javascript
{slider.description && (
  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '0.25rem' }}>
    {slider.description}
  </p>
)}
```

Full label section:

```javascript
<label style={{ display: 'block', marginBottom: '0.5rem' }}>
  <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#0f0d0a' }}>
    {slider.label}
  </span>
  {slider.description && (
    <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '0.25rem', margin: 0 }}>
      {slider.description}
    </p>
  )}
</label>
```

**Step 4: Test slider descriptions**

1. Open app and click "⚙ Physics" to expand the panel
2. Verify each slider now has a label and short descriptive text
3. Verify descriptions fit within the panel width
4. Test on mobile (375px width) to ensure no overflow

```bash
npm start
```

**Step 5: Commit**

```bash
git add src/components/PhysicsPanel.js
git commit -m "feat: add human-readable descriptions to physics sliders"
```

---

## Testing Checklist

- [ ] Double-click opens edit modal on any node type
- [ ] New nodes are auto-numbered (Theme 1, Code 1, Subtheme 1, etc.)
- [ ] Empty-state overlay appears when canvas has zero nodes
- [ ] Empty-state disappears when first node is added
- [ ] Connect button shows active state (white+red) when connectMode=true
- [ ] Canvas hint text appears when in connect mode
- [ ] Canvas cursor is default on background, grab on nodes
- [ ] Physics slider labels include readable descriptions
- [ ] All E2E tests pass: `npx playwright test`
- [ ] No regressions in import, export, focus view, or alignment features

---

## Summary

These 6 fixes are self-contained and use only existing patterns:
- Modal dispatch in App.js (no new state)
- Inline styling and Tailwind (no new CSS)
- GraphNode and Canvas component props (no new components)
- No new reducer actions or context
- No architectural changes
