# UI Redesign & Feature Additions — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the thematic analysis app with dynamic node sizing, Neo-Brutalist aesthetics, animated interactions, multi-sheet Excel import, search/filter, alignment, and focus view.

**Architecture:** React 19 + D3 v7 hybrid — D3 owns `x`/`y` positions via force simulation, React owns all rendering. Never let D3 touch the DOM. Framer Motion 12 handles all entrance/exit animations. A new unified `GraphNode` component replaces the separate `ThemeNode`/`CodeNode` files. All new state lives in `App.js`.

**Tech Stack:** React 19, D3 v7, Framer Motion 12, Tailwind CSS 3, XLSX, PapaParse, Jest + @testing-library/react, Playwright (Chromium)

**Branch:** `feature/ui-redesign`

**Code review required** after each of the 10 tasks using `superpowers-extended-cc:code-reviewer`.

---

## Pre-flight: Create the branch

```bash
cd d:/thematic-analysis-app
git checkout -b feature/ui-redesign
```

Expected: `Switched to a new branch 'feature/ui-redesign'`

---

### Task 1: Foundation Utilities — `nodeUtils.js` + `motionConfig.js`

**Files:**
- Create: `src/utils/nodeUtils.js`
- Create: `src/utils/motionConfig.js`

These files are the single source of truth for node sizing and animation constants. All other tasks depend on them.

---

**Step 1: Create `src/utils/nodeUtils.js`**

```js
/**
 * nodeUtils.js
 * Single source of truth for node sizing.
 * All sizing logic reads from here — never hardcode 160 or 130 elsewhere.
 */

/**
 * Returns { diameter, fontSize } for a given node.
 * Minimum font size is 16px (per design spec).
 * Minimum diameter: theme 120px, code 100px.
 *
 * @param {{ type: string, label: string }} node
 * @returns {{ diameter: number, fontSize: number }}
 */
export function getNodeSize(node) {
  const charCount = (node.label || '').length;

  if (node.type === 'theme') {
    const fontSize = Math.max(16, Math.min(26, 16 + Math.floor(charCount / 6)));
    const diameter = Math.max(120, Math.round(fontSize * charCount * 0.55 + 48));
    return { diameter, fontSize };
  } else {
    // code node
    const fontSize = Math.max(16, Math.min(22, 16 + Math.floor(charCount / 8)));
    const diameter = Math.max(100, Math.round(fontSize * charCount * 0.52 + 40));
    return { diameter, fontSize };
  }
}

/**
 * Convenience: returns the radius (half of diameter) for a node.
 * Used by Canvas.js for fitToView bounding box calculation.
 */
export function getNodeRadius(node) {
  return getNodeSize(node).diameter / 2;
}
```

---

**Step 2: Create `src/utils/motionConfig.js`**

```js
/**
 * motionConfig.js
 * Shared animation constants for Framer Motion.
 *
 * Springs: used for spatial movement (scale, position).
 *   - entrance: slower settle, more organic for first appearance
 *   - hover: snappier response for interactive feedback
 *
 * Easings: used for opacity and presence transitions.
 *   standard is cubic-bezier(0.4, 0, 0.2, 1) — symmetric ease-in-out
 *   giving natural acceleration and deceleration.
 */

export const springs = {
  entrance: { type: 'spring', stiffness: 220, damping: 22 },
  hover:    { type: 'spring', stiffness: 380, damping: 28 },
};

export const easings = {
  standard: [0.4, 0, 0.2, 1],
};

/** Tooltip presence animation variants — used with AnimatePresence */
export const tooltipVariants = {
  hidden: {
    opacity: 0,
    y: 6,
    transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] },
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  },
};
```

---

**Step 3: Run existing tests to confirm no regression**

```bash
cd d:/thematic-analysis-app && npm test -- --watchAll=false
```

Expected: all tests pass (4 tests, 2 suites). These new files have no side effects.

---

**Step 4: Commit**

```bash
cd d:/thematic-analysis-app
git add src/utils/nodeUtils.js src/utils/motionConfig.js
git commit -m "feat: add nodeUtils and motionConfig foundation utilities"
```

---

**Step 5: Code review**

Use `superpowers-extended-cc:code-reviewer` to review this task before proceeding.

---

### Task 2: Unified `GraphNode` Component

**Files:**
- Create: `src/components/nodes/GraphNode.js`
- Keep (do not delete yet): `src/components/nodes/ThemeNode.js`, `src/components/nodes/CodeNode.js`
  - These will be deleted in Task 3 after Canvas.js is updated.

**Goal:** A single component that renders both theme and code nodes, using `getNodeSize()` for dynamic sizing and `motionConfig` springs for animation. Theme nodes are visually heavier (planet aesthetic). Code nodes are lighter (satellite aesthetic). All animation and accessibility are handled here.

---

**Step 1: Create `src/components/nodes/GraphNode.js`**

```jsx
/**
 * GraphNode.js
 * ──────────────────────────────────────────────────────────────────────────
 * Unified node component for both theme (planet) and code (satellite) nodes.
 *
 * Replaces ThemeNode.js and CodeNode.js.
 *
 * PROPS:
 *   node           {Object}   — node data from GraphContext
 *   position       {x, y}    — D3-managed screen position
 *   isSelected     {boolean}
 *   isConnecting   {boolean}
 *   connectMode    {boolean}
 *   focusThemeId   {string|null} — if set, dims nodes outside the focused cluster
 *   focusedNodeIds {Set<string>} — set of IDs in the focused cluster (or empty)
 *   onMouseEnter   {fn}
 *   onMouseLeave   {fn}
 *   onContextMenu  {fn}
 *   onClick        {fn}
 *   onPointerDown  {fn}
 *   onPointerMove  {fn}
 *   onPointerUp    {fn}
 */

import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { getNodeSize } from '../../utils/nodeUtils';
import { springs } from '../../utils/motionConfig';

export default function GraphNode({
  node,
  position,
  isSelected = false,
  isConnecting = false,
  connectMode = false,
  focusThemeId = null,
  focusedNodeIds = new Set(),
  onMouseEnter = () => {},
  onMouseLeave = () => {},
  onContextMenu,
  onClick = () => {},
  onPointerDown,
  onPointerMove,
  onPointerUp,
}) {
  const isTheme = node.type === 'theme';
  const { diameter, fontSize } = getNodeSize(node);
  const radius = diameter / 2;
  const color = node.color || (isTheme ? '#6366f1' : '#64748b');

  // Opacity: dim if focus is active and this node is not in the focused cluster
  const isFocused = !focusThemeId || focusedNodeIds.has(node.id);
  const opacity = isFocused ? 1 : 0.2;

  // Box shadow: hard offset (Neo-Brutalist) + optional glow for states
  const getBoxShadow = () => {
    if (isConnecting) {
      return `0 0 0 4px #fff, 0 0 24px 8px ${color}`;
    }
    if (isSelected) {
      return `0 0 0 3px #fff, 0 0 16px 4px ${color}`;
    }
    if (isTheme) {
      // Planet: stronger hard shadow in theme color
      return `6px 6px 0 ${color}88`;
    }
    // Satellite: lighter hard shadow
    return `4px 4px 0 rgba(0,0,0,0.35)`;
  };

  // Keyboard handler for accessibility
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(e);
    }
  }, [onClick]);

  // Motion variants
  const variants = {
    initial:    { scale: 0.6, opacity: 0 },
    visible:    { scale: isSelected ? 1.04 : 1, opacity, transition: springs.entrance },
    connecting: {
      scale: 1.08,
      opacity: [opacity, opacity * 0.8, opacity],
      transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
    },
  };

  // Border: theme nodes get 3px, code nodes 2px
  const borderWidth = isTheme ? 3 : 2;
  const borderColor = isTheme ? 'white' : 'rgba(255,255,255,0.25)';

  return (
    <motion.button
      className={isTheme ? 'graph-node graph-node--theme' : 'graph-node graph-node--code'}
      initial="initial"
      animate={isConnecting ? 'connecting' : 'visible'}
      variants={variants}
      whileHover={{ scale: isTheme ? 1.06 : 1.08, transition: springs.hover }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onKeyDown={handleKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      aria-label={`${node.label || 'Unnamed'} — ${isTheme ? 'theme' : 'code'} node`}
      aria-pressed={isSelected}
      style={{
        position:        'absolute',
        left:            position ? position.x - radius : 0,
        top:             position ? position.y - radius : 0,
        width:           diameter,
        height:          diameter,
        borderRadius:    '50%',
        backgroundColor: color,
        border:          `${borderWidth}px solid ${borderColor}`,
        boxShadow:       getBoxShadow(),
        cursor:          connectMode ? 'crosshair' : 'grab',
        touchAction:     'none',
        pointerEvents:   'auto',
        userSelect:      'none',
        zIndex:          isSelected || isConnecting ? 20 : (isTheme ? 12 : 10),
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         0,
        background:      color, // override button default
        outline:         'none', // handled by focus-visible below
      }}
    >
      {/* Label */}
      <span
        style={{
          textAlign:    'center',
          padding:      isTheme ? '10px 18px' : '10px 14px',
          color:        'white',
          fontSize:     fontSize,
          fontWeight:   isTheme ? 700 : 600,
          lineHeight:   1.2,
          wordBreak:    'break-word',
          // No truncation — label always fully visible
        }}
      >
        {node.label || (isTheme ? 'Untitled Theme' : 'Untitled Code')}
      </span>

      {/* Theme indicator badge */}
      {isTheme && (
        <span
          aria-hidden="true"
          style={{
            position:        'absolute',
            bottom:          10,
            right:           10,
            width:           14,
            height:          14,
            borderRadius:    '50%',
            backgroundColor: 'white',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            fontSize:        10,
            fontWeight:      700,
            color:           color,
            lineHeight:      1,
          }}
        >
          ✓
        </span>
      )}
    </motion.button>
  );
}
```

---

**Step 2: Add focus ring CSS for accessibility**

Open `src/components/Canvas.css` and append at the bottom:

```css
/* Focus ring for graph nodes — visible on keyboard nav, hidden on mouse click */
.graph-node:focus-visible {
  outline: 3px solid #dc2626;
  outline-offset: 3px;
}
```

---

**Step 3: Run existing tests**

```bash
cd d:/thematic-analysis-app && npm test -- --watchAll=false
```

Expected: all pass. (GraphNode not yet wired into Canvas so no runtime impact.)

---

**Step 4: Commit**

```bash
cd d:/thematic-analysis-app
git add src/components/nodes/GraphNode.js src/components/Canvas.css
git commit -m "feat: add unified GraphNode component with dynamic sizing and accessibility"
```

---

**Step 5: Code review**

Use `superpowers-extended-cc:code-reviewer` before continuing.

---

### Task 3: Wire `Canvas.js` to `GraphNode` + per-node radius

**Files:**
- Modify: `src/components/Canvas.js` — 4 targeted changes (see steps below)
- Delete: `src/components/nodes/ThemeNode.js`
- Delete: `src/components/nodes/CodeNode.js`

**Goal:** Canvas renders `GraphNode` instead of `ThemeNode`/`CodeNode`. The `fitToView` bounding box uses `getNodeRadius(node)` per-node instead of the shared constants.

---

**Step 1: Update imports in `Canvas.js`**

Remove lines 25–28 (the old imports):
```js
// REMOVE these 4 lines:
import CodeNode from './nodes/CodeNode';
import ThemeNode, { THEME_NODE_SIZE } from './nodes/ThemeNode';
import QuoteTooltip from './QuoteTooltip';
import { CODE_NODE_SIZE } from './nodes/CodeNode';
```

Replace with:
```js
import GraphNode from './nodes/GraphNode';
import QuoteTooltip from './QuoteTooltip';
import { getNodeRadius } from '../utils/nodeUtils';
```

---

**Step 2: Update `fitToView` bounding box (Canvas.js line ~352)**

Find this line inside `fitToView`:
```js
const halfSize = node.type === 'theme' ? THEME_NODE_SIZE / 2 : CODE_NODE_SIZE / 2;
```

Replace with:
```js
const halfSize = getNodeRadius(node);
```

---

**Step 3: Update the node render in Canvas.js**

Find the section that renders `ThemeNode` and `CodeNode` (inside the node map, typically around line 430–500). It will look like:

```jsx
{node.type === 'theme' ? (
  <ThemeNode
    key={node.id}
    nodeId={node.id}
    node={node}
    position={pos}
    isSelected={...}
    isConnecting={...}
    onClick={...}
    onContextMenu={...}
    onMouseEnter={...}
    onMouseLeave={...}
    onPointerDown={...}
    onPointerMove={...}
    onPointerUp={...}
  />
) : (
  <CodeNode
    key={node.id}
    node={node}
    position={pos}
    isSelected={...}
    isConnecting={...}
    connectMode={connectMode}
    onMouseEnter={...}
    onMouseLeave={...}
    onDoubleClick={...}
    onContextMenu={...}
    onMouseDown={...}
    onClick={...}
    onPointerDown={...}
    onPointerMove={...}
    onPointerUp={...}
  />
)}
```

Replace the entire conditional with a single `GraphNode`:

```jsx
<GraphNode
  key={node.id}
  node={node}
  position={pos}
  isSelected={isSelected}
  isConnecting={isConnecting}
  connectMode={connectMode}
  focusThemeId={focusThemeId}
  focusedNodeIds={focusedNodeIds}
  onMouseEnter={() => handleNodeMouseEnter(node)}
  onMouseLeave={handleNodeMouseLeave}
  onContextMenu={(e) => handleNodeContextMenu(e, node)}
  onClick={(e) => handleNodeClick(e, node)}
  onPointerDown={(e) => handlePointerDown(e, node.id)}
  onPointerMove={handlePointerMove}
  onPointerUp={handlePointerUp}
/>
```

> Note: `focusThemeId` and `focusedNodeIds` are not yet provided (that's Task 8). Add them as props with defaults `focusThemeId={null}` and `focusedNodeIds={new Set()}` for now.

---

**Step 4: Add `focusThemeId` and `focusedNodeIds` props to `Canvas`**

At the top of the Canvas component props:

```js
export default function Canvas({
  connectMode = false,
  physicsParams,
  onContextMenu,
  onFitReady,
  focusThemeId = null,      // NEW
  focusedNodeIds = new Set(), // NEW
}) {
```

For now, these are passed down to each `GraphNode` but have default no-op values. `App.js` will wire them in Task 8.

---

**Step 5: Delete old node files**

```bash
cd d:/thematic-analysis-app
rm src/components/nodes/ThemeNode.js
rm src/components/nodes/CodeNode.js
```

---

**Step 6: Run all tests**

```bash
cd d:/thematic-analysis-app && npm test -- --watchAll=false
```

Expected: all pass. Any import errors from old files will surface here — fix them before committing.

---

**Step 7: Run E2E tests**

```bash
cd d:/thematic-analysis-app && npm run test:e2e
```

Expected: all 13 Playwright tests pass. Node rendering is visually different but all E2E interactions (click, drag, connect) should still work.

---

**Step 8: Commit**

```bash
cd d:/thematic-analysis-app
git add src/components/Canvas.js
git rm src/components/nodes/ThemeNode.js src/components/nodes/CodeNode.js
git commit -m "feat: wire Canvas to GraphNode, per-node radius in fitToView"
```

---

**Step 9: Code review**

Use `superpowers-extended-cc:code-reviewer`. This is the riskiest task — the D3/React boundary is touched. The reviewer should specifically verify that D3 still owns positions and the DOM is not mutated by D3.

---

### Task 4: Tooltip Fade Animation

**Files:**
- Modify: `src/components/QuoteTooltip.js`

**Goal:** Wrap the tooltip in `AnimatePresence` so it fades in (opacity + translateY) on mount and fades out on unmount instead of instantly appearing/disappearing.

---

**Step 1: Rewrite `src/components/QuoteTooltip.js`**

```jsx
/**
 * QuoteTooltip.js
 * Floating tooltip shown when hovering a code node.
 * Uses AnimatePresence for fade-in/out with translateY offset.
 *
 * ANIMATION:
 *   Enter: opacity 0→1, y 6→0, 200ms cubic-bezier(0.4,0,0.2,1)
 *   Exit:  opacity 1→0, y 0→4, 150ms cubic-bezier(0.4,0,0.2,1)
 *
 * PROPS:
 *   visible  {boolean}
 *   x, y     {number}   — mouse position (canvas-relative)
 *   code     {string}
 *   quote    {string}
 *   source   {string}
 *   color    {string}
 */

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { tooltipVariants } from '../utils/motionConfig';

const TOOLTIP_WIDTH = 320;

export default function QuoteTooltip({ visible, x, y, code, quote, source, color }) {
  const left = Math.min(x + 18, window.innerWidth  - TOOLTIP_WIDTH - 16);
  const top  = Math.min(Math.max(y - 10, 16), window.innerHeight - 16);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="tooltip"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={tooltipVariants}
          style={{
            position:      'absolute',
            left,
            top,
            borderColor:   color + '55',
            pointerEvents: 'none',
            zIndex:        50,
            width:         TOOLTIP_WIDTH,
          }}
          className="bg-slate-800 border rounded-xl p-4 shadow-2xl"
        >
          {/* Left accent bar */}
          <div
            aria-hidden="true"
            style={{
              position:        'absolute',
              left:            0,
              top:             12,
              bottom:          12,
              width:           4,
              borderRadius:    '0 2px 2px 0',
              backgroundColor: color,
            }}
          />

          {/* Code label */}
          <p className="text-base font-bold mb-2 pl-3" style={{ color, fontSize: 16 }}>
            {code}
          </p>

          {/* Raw quote */}
          <p className="text-base text-slate-200 italic leading-relaxed mb-3 pl-3"
             style={{ fontSize: 16 }}>
            "{quote}"
          </p>

          {/* Source */}
          <p className="text-base text-slate-500 font-semibold uppercase tracking-wide pl-3"
             style={{ fontSize: 16 }}>
            ↳ {source || 'Unknown source'}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

---

**Step 2: Run tests**

```bash
cd d:/thematic-analysis-app && npm test -- --watchAll=false
```

Expected: all pass.

---

**Step 3: Commit**

```bash
cd d:/thematic-analysis-app
git add src/components/QuoteTooltip.js
git commit -m "feat: animate tooltip with AnimatePresence fade-in/out"
```

---

**Step 4: Code review**

Use `superpowers-extended-cc:code-reviewer`.

---

### Task 5: Multi-Sheet Excel Import

**Files:**
- Modify: `src/utils/importUtils.js` — update `parseXlsx` signature
- Modify: `src/components/modals/ImportModal.js` — add sheet selector step
- Modify: `src/utils/importUtils.test.js` (if it has XLSX tests, update them)

**Goal:** When an `.xlsx` workbook has multiple sheets, show a sheet selector step before the preview. Single-sheet workbooks and CSVs skip directly to preview (no regression for existing behavior).

---

**Step 1: Update `importUtils.js`**

Change `parseFile` signature and `parseXlsx` to support sheet selection.

Find in `importUtils.js`:

```js
export async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'csv') {
    return parseCsv(file);
  } else if (ext === 'xlsx' || ext === 'xls') {
    return parseXlsx(file);
  } else {
    throw new Error(`Unsupported file type: .${ext}. Use .xlsx or .csv`);
  }
}
```

Replace with:

```js
/**
 * Get the list of sheet names from an xlsx file without fully parsing it.
 * Returns ['Sheet1'] for CSVs (virtual single sheet).
 *
 * @param {File} file
 * @returns {Promise<string[]>}
 */
export async function getSheetNames(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'csv') return ['Sheet1'];
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  return workbook.SheetNames;
}

/**
 * Parse a File object (xlsx or csv) and return raw row objects.
 *
 * @param {File} file
 * @param {string|null} sheetName — which sheet to read (xlsx only). Defaults to first sheet.
 * @returns {Promise<Array<{source,quote,code,theme}>>}
 */
export async function parseFile(file, sheetName = null) {
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'csv') {
    return parseCsv(file);
  } else if (ext === 'xlsx' || ext === 'xls') {
    return parseXlsx(file, sheetName);
  } else {
    throw new Error(`Unsupported file type: .${ext}. Use .xlsx or .csv`);
  }
}
```

Then update `parseXlsx`:

```js
/** Parse XLSX using the xlsx library */
async function parseXlsx(file, sheetName = null) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const targetSheet = sheetName ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[targetSheet];

  if (!sheet) {
    throw new Error(`Sheet "${targetSheet}" not found in workbook.`);
  }

  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  if (raw.length < 2) return [];

  const headers = raw[0].map(normalizeHeader);

  const rows = raw.slice(1)
    .filter(row => row.some(cell => cell !== null && cell !== ''))
    .map(row => {
      const obj = {};
      headers.forEach((key, i) => {
        if (key) obj[key] = (row[i] != null && row[i] !== '') ? String(row[i]).trim() : null;
      });
      return obj;
    });

  return rows;
}
```

---

**Step 2: Update `ImportModal.js`**

The wizard becomes 3 steps: Upload → Sheet Selector (xlsx multi-sheet only) → Preview.

Rewrite `ImportModal.js`:

```jsx
/**
 * ImportModal.js
 * Three-step import wizard: Upload → Sheet Select (xlsx multi-sheet) → Preview & Confirm.
 * Sheet select step is skipped for CSV and single-sheet workbooks.
 */

import React, { useState, useRef } from 'react';
import { useGraph, useGraphDispatch } from '../../context/GraphContext';
import { parseFile, buildGraphFromRows, generateTemplate, getSheetNames } from '../../utils/importUtils';

export default function ImportModal({ open, onClose }) {
  const { nodes }  = useGraph();
  const dispatch   = useGraphDispatch();

  const [step,        setStep]        = useState(1);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [result,      setResult]      = useState(null);
  const [clearFirst,  setClearFirst]  = useState(false);
  const [fileName,    setFileName]    = useState('');
  const [sheetNames,  setSheetNames]  = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [file,        setFile]        = useState(null);
  const fileInputRef = useRef(null);

  if (!open) return null;

  // ── File upload (step 1 → 2 or 3) ───────────────────────────────────────────
  async function handleFile(uploadedFile) {
    if (!uploadedFile) return;
    setLoading(true);
    setError(null);
    setFileName(uploadedFile.name);
    setFile(uploadedFile);
    try {
      const sheets = await getSheetNames(uploadedFile);
      setSheetNames(sheets);

      if (sheets.length > 1) {
        // Multi-sheet: go to sheet selector
        setSelectedSheet(sheets[0]);
        setStep(2);
      } else {
        // Single sheet or CSV: skip to preview
        await loadPreview(uploadedFile, sheets[0]);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Load preview (used from step 1 and step 2) ────────────────────────────
  async function loadPreview(fileToUse, sheetName) {
    setLoading(true);
    setError(null);
    try {
      const parsed = await parseFile(fileToUse, sheetName);
      const existingThemes = nodes.filter(n => n.type === 'theme');
      const built = buildGraphFromRows(parsed, clearFirst ? [] : existingThemes);
      setResult(built);
      setStep(3);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  }

  function handleInputChange(e) {
    handleFile(e.target.files[0]);
  }

  // ── Sheet confirmation (step 2 → 3) ─────────────────────────────────────────
  async function handleSheetConfirm() {
    if (!file || !selectedSheet) return;
    await loadPreview(file, selectedSheet);
  }

  // ── Confirm import ───────────────────────────────────────────────────────────
  function handleConfirm() {
    if (!result) return;
    if (clearFirst) dispatch({ type: 'CLEAR' });
    if (result.themeNodes.length > 0) dispatch({ type: 'ADD_NODES', nodes: result.themeNodes });
    if (result.codeNodes.length > 0) dispatch({ type: 'ADD_NODES', nodes: result.codeNodes });
    result.edges.forEach(edge => dispatch({ type: 'ADD_EDGE', edge }));
    handleClose();
  }

  // ── Template download ────────────────────────────────────────────────────────
  function handleTemplateDownload() {
    const blob = generateTemplate();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'thematic-analysis-template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleClose() {
    setStep(1); setResult(null); setError(null); setFileName('');
    setSheetNames([]); setSelectedSheet(''); setFile(null);
    onClose();
  }

  // ── Preview rows ─────────────────────────────────────────────────────────────
  const previewRows = result
    ? result.codeNodes.slice(0, 8).map(cn => {
        const theme = result.themeNodes.find(t => t.id === cn.primaryThemeId)
          ?? nodes.find(n => n.id === cn.primaryThemeId);
        return { code: cn.label, quote: cn.quote, theme, unassigned: !cn.primaryThemeId };
      })
    : [];

  const totalSteps = 3;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div
        className="bg-slate-800 border border-slate-600 rounded-2xl p-7 w-[700px] max-w-full shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-6" aria-label={`Step ${step} of ${totalSteps}`}>
          {[1, 2, 3].map((s, i) => (
            <React.Fragment key={s}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base font-bold ${step === s ? 'bg-indigo-600 text-white' : 'bg-slate-600 text-slate-400'}`}
                   aria-current={step === s ? 'step' : undefined}>
                {s}
              </div>
              {i < 2 && <div className="flex-1 h-px bg-slate-600" />}
            </React.Fragment>
          ))}
        </div>

        {/* STEP 1: Upload */}
        {step === 1 && (
          <>
            <h2 id="import-modal-title" className="text-xl font-bold text-white mb-1">Import Data</h2>
            <p className="text-base text-slate-400 mb-6">Upload a .xlsx or .csv file. Expected columns: Source, Quoted Text, Code, Preliminary Theme.</p>

            <div
              className="border-2 border-dashed border-slate-600 rounded-xl p-10 text-center cursor-pointer hover:border-indigo-500 hover:text-indigo-400 transition-colors mb-5 text-slate-400"
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              aria-label="Upload file — drag and drop or click to browse"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
            >
              <div className="text-4xl mb-3" aria-hidden="true">📂</div>
              <p className="text-base">Drag & drop your file here, or <span className="text-indigo-400 font-semibold">click to browse</span></p>
              <p className="text-base text-slate-500 mt-2">Accepts .xlsx and .csv</p>
            </div>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleInputChange} aria-label="File input" />

            <div className="flex items-center gap-3 mb-5">
              <span className="text-base text-slate-400">Need a template?</span>
              <button onClick={handleTemplateDownload} className="text-base font-semibold text-indigo-400 hover:text-indigo-300 border border-slate-600 px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors">
                ↓ Download Template
              </button>
            </div>

            <label className="flex items-center gap-3 cursor-pointer mb-6">
              <input type="checkbox" checked={clearFirst} onChange={e => setClearFirst(e.target.checked)} className="w-5 h-5 accent-indigo-500" />
              <span className="text-base text-slate-300">Clear existing canvas before importing</span>
            </label>

            {error && <p className="text-base text-red-400 mb-4" role="alert">⚠ {error}</p>}
            {loading && <p className="text-base text-slate-400" aria-live="polite">Parsing file…</p>}

            <div className="flex justify-end">
              <button onClick={handleClose} className="text-base font-semibold text-slate-400 px-5 py-2 rounded-lg border border-slate-600 hover:bg-slate-700 transition-colors" aria-label="Close">Cancel</button>
            </div>
          </>
        )}

        {/* STEP 2: Sheet selector */}
        {step === 2 && (
          <>
            <h2 id="import-modal-title" className="text-xl font-bold text-white mb-1">Select Sheet</h2>
            <p className="text-base text-slate-400 mb-6">
              <span className="text-white font-semibold">{fileName}</span> contains {sheetNames.length} sheets. Choose which one to import.
            </p>

            <div className="flex flex-col gap-2 mb-6">
              {sheetNames.map(name => (
                <label key={name} className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-slate-600 hover:bg-slate-700 transition-colors">
                  <input
                    type="radio"
                    name="sheet"
                    value={name}
                    checked={selectedSheet === name}
                    onChange={() => setSelectedSheet(name)}
                    className="accent-indigo-500"
                  />
                  <span className="text-base text-slate-200">{name}</span>
                </label>
              ))}
            </div>

            {error && <p className="text-base text-red-400 mb-4" role="alert">⚠ {error}</p>}
            {loading && <p className="text-base text-slate-400" aria-live="polite">Loading preview…</p>}

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="text-base font-semibold text-slate-400 px-5 py-2 rounded-lg border border-slate-600 hover:bg-slate-700 transition-colors">← Back</button>
              <div className="flex gap-3">
                <button onClick={handleClose} className="text-base font-semibold text-slate-400 px-5 py-2 rounded-lg border border-slate-600 hover:bg-slate-700 transition-colors" aria-label="Close">Cancel</button>
                <button onClick={handleSheetConfirm} disabled={!selectedSheet} className="text-base font-bold text-white px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50">
                  Preview Sheet →
                </button>
              </div>
            </div>
          </>
        )}

        {/* STEP 3: Preview */}
        {step === 3 && result && (
          <>
            <h2 id="import-modal-title" className="text-xl font-bold text-white mb-1">Preview Import</h2>
            <p className="text-base text-slate-400 mb-1">From <span className="text-white font-semibold">{fileName}</span>{selectedSheet && sheetNames.length > 1 ? ` — ${selectedSheet}` : ''}</p>
            <p className="text-base text-slate-400 mb-5">
              <span className="text-white font-semibold">{result.summary.codeCount}</span> code nodes,{' '}
              <span className="text-white font-semibold">{result.summary.themeCount}</span> new theme nodes —{' '}
              <span className="text-emerald-400 font-semibold">{result.summary.assigned} assigned</span>,{' '}
              <span className="text-slate-400 font-semibold">{result.summary.unassigned} unassigned</span>
            </p>

            <div className="overflow-hidden rounded-xl border border-slate-700 mb-5">
              <table className="w-full text-base">
                <thead className="bg-slate-900">
                  <tr>
                    <th className="text-left px-4 py-3 text-slate-400 font-semibold">Code</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-semibold">Quote</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-semibold">Theme</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-t border-slate-700 hover:bg-slate-700/40">
                      <td className="px-4 py-3 text-white font-medium max-w-[180px] truncate">{row.code}</td>
                      <td className="px-4 py-3 text-slate-400 italic max-w-[220px] truncate">"{row.quote}"</td>
                      <td className="px-4 py-3">
                        {row.theme
                          ? <span className="text-base font-bold px-3 py-1 rounded-full text-white" style={{ backgroundColor: row.theme.color }}>{row.theme.label}</span>
                          : <span className="text-base font-bold px-3 py-1 rounded-full text-white bg-slate-600">Unassigned</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.summary.codeCount > 8 && (
                <p className="text-base text-slate-500 px-4 py-2 bg-slate-900 text-center">… and {result.summary.codeCount - 8} more rows</p>
              )}
            </div>

            <div className="flex justify-between items-center">
              <button onClick={() => setStep(sheetNames.length > 1 ? 2 : 1)} className="text-base font-semibold text-slate-400 px-5 py-2 rounded-lg border border-slate-600 hover:bg-slate-700 transition-colors">← Back</button>
              <div className="flex gap-3">
                <button onClick={handleClose} className="text-base font-semibold text-slate-400 px-5 py-2 rounded-lg border border-slate-600 hover:bg-slate-700 transition-colors" aria-label="Close">Cancel</button>
                <button onClick={handleConfirm} className="text-base font-bold text-white px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors">✓ Confirm Import</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

---

**Step 3: Run tests**

```bash
cd d:/thematic-analysis-app && npm test -- --watchAll=false
```

Expected: all pass. If `importUtils.test.js` tests `parseFile`, they test the CSV path (no sheetName arg) so they should still pass.

---

**Step 4: Commit**

```bash
cd d:/thematic-analysis-app
git add src/utils/importUtils.js src/components/modals/ImportModal.js
git commit -m "feat: multi-sheet Excel support with sheet selector step in import wizard"
```

---

**Step 5: Code review**

Use `superpowers-extended-cc:code-reviewer`.

---

### Task 6: Search Bar

**Files:**
- Modify: `src/App.js` — add search state + pass to Canvas + Toolbar
- Modify: `src/components/Toolbar.js` — add expandable search UI
- Modify: `src/components/Canvas.js` — receive search props, apply opacity mask

**Goal:** A toolbar button expands to reveal a search input with THEMES/CODES filter toggles. Matched nodes get a red highlight shadow. Unmatched nodes dim to 25%.

---

**Step 1: Add search state to `App.js`**

In `AppInner`, after the existing modal state declarations:

```js
// ── Search state ─────────────────────────────────────────────────────────────
const [searchOpen,    setSearchOpen]    = useState(false);
const [searchQuery,   setSearchQuery]   = useState('');
const [searchFilters, setSearchFilters] = useState({ themes: true, codes: true });
```

Pass to Toolbar:
```jsx
<Toolbar
  // ... existing props ...
  searchOpen={searchOpen}
  searchQuery={searchQuery}
  searchFilters={searchFilters}
  onSearchToggle={() => { setSearchOpen(o => !o); if (searchOpen) setSearchQuery(''); }}
  onSearchChange={setSearchQuery}
  onSearchFilterChange={(key) => setSearchFilters(f => ({ ...f, [key]: !f[key] }))}
/>
```

Pass to Canvas:
```jsx
<Canvas
  // ... existing props ...
  searchQuery={searchQuery}
  searchFilters={searchFilters}
/>
```

---

**Step 2: Add search UI to `Toolbar.js`**

Add after the existing `TbBtn` declaration:

```jsx
import React, { useRef, useEffect } from 'react';
```

Update the `Toolbar` component:

```jsx
export default function Toolbar({
  // ... existing props ...
  searchOpen, searchQuery, searchFilters,
  onSearchToggle, onSearchChange, onSearchFilterChange,
}) {
  const searchInputRef = useRef(null);

  // Focus the input when search opens
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // Close search on Escape
  function handleSearchKeyDown(e) {
    if (e.key === 'Escape') onSearchToggle();
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 border-b border-slate-700 z-10 flex-shrink-0 flex-wrap">
      {/* ... existing toolbar content ... */}

      {/* Search — progressive disclosure */}
      <div role="search" className="flex items-center gap-2 ml-auto">
        {searchOpen && (
          <>
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search nodes…"
              aria-label="Search nodes"
              className="text-base bg-slate-700 text-white border border-slate-500 rounded-lg px-3 py-2 w-52 focus:outline-none focus:border-indigo-400"
            />
            <TbBtn
              onClick={() => onSearchFilterChange('themes')}
              active={searchFilters.themes}
              aria-pressed={searchFilters.themes}
            >
              Themes
            </TbBtn>
            <TbBtn
              onClick={() => onSearchFilterChange('codes')}
              active={searchFilters.codes}
              aria-pressed={searchFilters.codes}
            >
              Codes
            </TbBtn>
          </>
        )}
        <TbBtn onClick={onSearchToggle} active={searchOpen} aria-pressed={searchOpen}>
          {searchOpen ? '✕ Search' : '⌕ Search'}
        </TbBtn>
      </div>

      {/* ... existing physics/clear buttons (remove ml-auto from spacer) ... */}
    </div>
  );
}
```

> Note: Remove the `<div className="flex-1" />` spacer since search now uses `ml-auto`. Physics and Clear buttons stay at the right end.

---

**Step 3: Apply search opacity mask in `Canvas.js`**

Add `searchQuery` and `searchFilters` as props to `Canvas`:

```js
export default function Canvas({
  // ... existing ...
  searchQuery = '',
  searchFilters = { themes: true, codes: true },
}) {
```

Before the node render map, compute matched/unmatched sets:

```js
// Compute search highlight state
const searchActive = searchQuery.trim().length > 0;
const lowerQuery = searchQuery.toLowerCase().trim();

const matchedNodeIds = useMemo(() => {
  if (!searchActive) return new Set();
  return new Set(
    graphState.nodes
      .filter(n => {
        const typeMatch =
          (n.type === 'theme' && searchFilters.themes) ||
          (n.type === 'code'  && searchFilters.codes);
        return typeMatch && (n.label || '').toLowerCase().includes(lowerQuery);
      })
      .map(n => n.id)
  );
}, [graphState.nodes, searchQuery, searchFilters, searchActive]);
```

Then pass to each `GraphNode`:

```jsx
<GraphNode
  // ... existing props ...
  searchActive={searchActive}
  isSearchMatch={matchedNodeIds.has(node.id)}
/>
```

Update `GraphNode.js` to accept and apply these:

In `GraphNode.js` props, add:
```js
searchActive = false,
isSearchMatch = false,
```

In `GraphNode.js` style, compute final opacity:
```js
// Search dims unmatched nodes; focus dims non-cluster nodes. Search takes precedence.
let finalOpacity = 1;
if (searchActive) {
  finalOpacity = isSearchMatch ? 1 : 0.25;
} else if (focusThemeId) {
  finalOpacity = isFocused ? 1 : 0.2;
}
```

And search match highlight in `getBoxShadow`:
```js
if (searchActive && isSearchMatch) {
  // Red offset shadow for matched nodes
  return `4px 4px 0 #dc2626`;
}
```

---

**Step 4: Run tests**

```bash
cd d:/thematic-analysis-app && npm test -- --watchAll=false && npm run test:e2e
```

Expected: all pass.

---

**Step 5: Commit**

```bash
cd d:/thematic-analysis-app
git add src/App.js src/components/Toolbar.js src/components/Canvas.js src/components/nodes/GraphNode.js
git commit -m "feat: add expandable search bar with filter toggles and node highlight"
```

---

**Step 6: Code review**

Use `superpowers-extended-cc:code-reviewer`.

---

### Task 7: Alignment Button

**Files:**
- Modify: `src/App.js` — add `handleAlign` function, pass to Toolbar
- Modify: `src/components/Toolbar.js` — add Align button
- Modify: `src/components/Canvas.js` — expose simulation ref upward OR accept align trigger

**Goal:** One-click radial-then-settle layout. Themes go to a ring. Each theme's code nodes go to a sub-ring around it. Unassigned codes go to canvas center. Then physics runs from those positions.

---

**Step 1: Add `handleAlign` to `App.js`**

```js
function handleAlign() {
  const themeNodes     = nodes.filter(n => n.type === 'theme');
  const codeNodes      = nodes.filter(n => n.type === 'code');
  const cx = window.innerWidth  / 2;
  const cy = window.innerHeight / 2;

  // Radius of the theme ring — scales with number of themes
  const themeRingR = Math.max(300, themeNodes.length * 80);

  // 1. Position theme nodes on outer ring
  themeNodes.forEach((theme, i) => {
    const angle = (2 * Math.PI * i) / themeNodes.length - Math.PI / 2;
    dispatch({
      type: 'UPDATE_NODE',
      id: theme.id,
      changes: {
        x: cx + Math.cos(angle) * themeRingR,
        y: cy + Math.sin(angle) * themeRingR,
      },
    });
  });

  // 2. Position code nodes in sub-rings around their theme
  themeNodes.forEach((theme, ti) => {
    const themeAngle = (2 * Math.PI * ti) / themeNodes.length - Math.PI / 2;
    const themeX     = cx + Math.cos(themeAngle) * themeRingR;
    const themeY     = cy + Math.sin(themeAngle) * themeRingR;
    const connected  = codeNodes.filter(n => n.primaryThemeId === theme.id);
    const codeRingR  = 120 + connected.length * 12;

    connected.forEach((code, ci) => {
      const codeAngle = (2 * Math.PI * ci) / connected.length - Math.PI / 2;
      dispatch({
        type: 'UPDATE_NODE',
        id: code.id,
        changes: {
          x: themeX + Math.cos(codeAngle) * codeRingR,
          y: themeY + Math.sin(codeAngle) * codeRingR,
        },
      });
    });
  });

  // 3. Unassigned code nodes → cluster at canvas center
  const unassigned = codeNodes.filter(n => !n.primaryThemeId);
  unassigned.forEach((code, i) => {
    const angle = (2 * Math.PI * i) / Math.max(unassigned.length, 1);
    dispatch({
      type: 'UPDATE_NODE',
      id: code.id,
      changes: {
        x: cx + Math.cos(angle) * 80,
        y: cy + Math.sin(angle) * 80,
      },
    });
  });

  // 4. Reheat simulation so it settles from new positions
  alignTriggerRef.current?.();
}
```

Add a ref for the align trigger:
```js
const alignTriggerRef = useRef(null);
```

Pass to Canvas:
```jsx
<Canvas
  // ... existing ...
  onAlignReady={(fn) => { alignTriggerRef.current = fn; }}
/>
```

---

**Step 2: Expose align trigger from `Canvas.js`**

In `Canvas.js`, add prop `onAlignReady` and expose a function that reheats the simulation:

```js
export default function Canvas({
  // ... existing ...
  onAlignReady,
}) {
```

After the simulation is set up, expose the reheat function:

```js
useEffect(() => {
  if (onAlignReady) {
    onAlignReady(() => {
      if (simulation.current) {
        simulation.current.alpha(0.5).restart();
      }
    });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

> Check `forceSimulation.js` to see if `alpha()` and `restart()` are exposed on the simulation wrapper. If not, expose them there too.

---

**Step 3: Check `forceSimulation.js`**

```bash
cat d:/thematic-analysis-app/src/utils/forceSimulation.js
```

If the simulation wrapper doesn't expose `alpha` and `restart`, add them:

```js
// In the returned object from createSimulation:
alpha: (val) => { sim.alpha(val); return wrapper; },
restart: () => { sim.restart(); return wrapper; },
```

---

**Step 4: Add Align button to `Toolbar.js`**

```jsx
<TbBtn onClick={onAlign}>⊹ Align</TbBtn>
```

Add to `onAlign` prop in Toolbar's prop list.

---

**Step 5: Wire Toolbar in `App.js`**

```jsx
<Toolbar
  // ... existing ...
  onAlign={handleAlign}
/>
```

---

**Step 6: Run tests**

```bash
cd d:/thematic-analysis-app && npm test -- --watchAll=false && npm run test:e2e
```

Expected: all pass.

---

**Step 7: Commit**

```bash
cd d:/thematic-analysis-app
git add src/App.js src/components/Toolbar.js src/components/Canvas.js src/utils/forceSimulation.js
git commit -m "feat: add alignment button with radial-then-settle layout"
```

---

**Step 8: Code review**

Use `superpowers-extended-cc:code-reviewer`.

---

### Task 8: Focus View

**Files:**
- Modify: `src/App.js` — add `focusThemeId` state + `handleContextMenu` update
- Modify: `src/components/Canvas.js` — wire focus props to `GraphNode` + `fitToView` scoped to cluster + Exit Focus button
- `GraphNode.js` already accepts `focusThemeId` and `focusedNodeIds` from Task 3.

**Goal:** Right-click a theme → "Focus View" dims everything outside the cluster and zooms camera to frame it. Escape or "Exit Focus" button restores normal view.

---

**Step 1: Add focus state to `App.js`**

```js
const [focusThemeId, setFocusThemeId] = useState(null);
```

Update `handleContextMenu` to add Focus View item for themes:

```js
} else if (type === 'theme-edit' || type === 'theme') {
  items = [
    { label: '✏ Rename / Edit Theme', action: () => setThemeEditId(id) },
    { label: '⊙ Focus View',          action: () => setFocusThemeId(id) },
    { label: '✕ Delete Theme', action: () => { ... }, danger: true },
  ];
}
```

Pass to Canvas:
```jsx
<Canvas
  // ... existing ...
  focusThemeId={focusThemeId}
  onExitFocus={() => setFocusThemeId(null)}
/>
```

---

**Step 2: Update `Canvas.js` for focus view**

Add props:
```js
export default function Canvas({
  // ... existing ...
  focusThemeId = null,
  onExitFocus,
}) {
```

Compute `focusedNodeIds` inside Canvas (needs edges to find connected codes):

```js
const focusedNodeIds = useMemo(() => {
  if (!focusThemeId) return new Set();
  const connectedCodeIds = graphState.edges
    .filter(e => e.target === focusThemeId)
    .map(e => e.source);
  return new Set([focusThemeId, ...connectedCodeIds]);
}, [focusThemeId, graphState.edges]);
```

Pass `focusThemeId` and `focusedNodeIds` to each `GraphNode` (already in the render from Task 3).

Add keyboard handler for Escape:
```js
useEffect(() => {
  function handleKeyDown(e) {
    if (e.key === 'Escape' && focusThemeId) {
      onExitFocus?.();
    }
  }
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [focusThemeId, onExitFocus]);
```

Zoom to cluster when `focusThemeId` changes:
```js
useEffect(() => {
  if (!focusThemeId || !zoomBehaviorRef.current || !svgRef.current) return;

  // Gather positions of focused nodes
  const focusedNodes = graphState.nodes.filter(n => focusedNodeIds.has(n.id));
  if (focusedNodes.length === 0) return;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  focusedNodes.forEach(node => {
    const pos      = positions.current.get(node.id) ?? { x: node.x ?? 0, y: node.y ?? 0 };
    const halfSize = getNodeRadius(node);
    minX = Math.min(minX, pos.x - halfSize);
    minY = Math.min(minY, pos.y - halfSize);
    maxX = Math.max(maxX, pos.x + halfSize);
    maxY = Math.max(maxY, pos.y + halfSize);
  });

  const PADDING = 80;
  const svgEl = svgRef.current;
  const W = svgEl.clientWidth  || 800;
  const H = svgEl.clientHeight || 600;
  const contentW = maxX - minX + 2 * PADDING;
  const contentH = maxY - minY + 2 * PADDING;
  const k = Math.min(W / contentW, H / contentH, MAX_ZOOM);
  const tx = W / 2 - k * ((minX + maxX) / 2);
  const ty = H / 2 - k * ((minY + maxY) / 2);

  d3.select(svgEl)
    .transition()
    .duration(600)
    .ease(d3.easeCubicInOut)
    .call(zoomBehaviorRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
}, [focusThemeId]);
```

Add Exit Focus pill button inside the Canvas render (outside the zoom/pan transform group):

```jsx
{focusThemeId && (
  <button
    onClick={onExitFocus}
    aria-label="Exit focus view"
    style={{
      position:        'absolute',
      bottom:          24,
      left:            '50%',
      transform:       'translateX(-50%)',
      zIndex:          40,
      backgroundColor: '#0f0d0a',
      color:           'white',
      border:          '2px solid white',
      boxShadow:       '4px 4px 0 #dc2626',
      padding:         '8px 20px',
      fontWeight:      700,
      fontSize:        16,
      cursor:          'pointer',
      borderRadius:    4,
    }}
  >
    ✕ Exit Focus
  </button>
)}
```

---

**Step 3: Run tests**

```bash
cd d:/thematic-analysis-app && npm test -- --watchAll=false && npm run test:e2e
```

Expected: all pass.

---

**Step 4: Commit**

```bash
cd d:/thematic-analysis-app
git add src/App.js src/components/Canvas.js
git commit -m "feat: add focus view — dims outside cluster, zooms camera to theme"
```

---

**Step 5: Code review**

Use `superpowers-extended-cc:code-reviewer`.

---

### Task 9: Neo-Brutalist UI Redesign

**Files:**
- Modify: `public/index.html` — add Bricolage Grotesque font link
- Modify: `src/index.css` (or `src/App.css`) — add CSS design tokens
- Modify: `src/components/Toolbar.js` — full redesign
- Modify: `src/components/Canvas.js` — canvas background color
- Modify: `src/components/nodes/GraphNode.js` — Neo-Brutalist node styling
- Modify: `src/components/QuoteTooltip.js` — white bg, black border
- Modify: `src/components/modals/ImportModal.js` — white bg, black border
- Modify: `src/components/modals/CodeEditModal.js` — white bg, black border
- Modify: `src/components/modals/ThemeEditModal.js` — white bg, black border
- Modify: `src/components/PhysicsPanel.js` — white bg, black border
- Modify: `src/components/ContextMenu.js` — white bg, black border
- Modify: `src/App.js` — status bar

**Design tokens:**
```
--bg-canvas:    #f0ebe3  (warm cream)
--bg-toolbar:   #0f0d0a  (near-black)
--bg-surface:   #ffffff
--text-primary: #0f0d0a
--text-muted:   #6b6560
--accent:       #dc2626  (red)
--border:       #0f0d0a
--shadow-hard:  6px 6px 0 #dc2626  (on primary actions)
--shadow-dark:  6px 6px 0 #0f0d0a  (on cards/surfaces)
Font: Bricolage Grotesque
```

---

**Step 1: Add font to `public/index.html`**

Add inside `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&display=swap" rel="stylesheet">
```

---

**Step 2: Add CSS variables to `src/index.css`**

```css
:root {
  --bg-canvas:    #f0ebe3;
  --bg-toolbar:   #0f0d0a;
  --bg-surface:   #ffffff;
  --text-primary: #0f0d0a;
  --text-muted:   #6b6560;
  --accent:       #dc2626;
  --border:       #0f0d0a;
  --shadow-hard:  6px 6px 0 #dc2626;
  --shadow-dark:  6px 6px 0 #0f0d0a;
}

body {
  font-family: 'Bricolage Grotesque', system-ui, sans-serif;
}
```

---

**Step 3: Redesign `Toolbar.js`**

Rewrite using Neo-Brutalist tokens:
- `bg-[#0f0d0a]` toolbar
- White text
- Primary actions get red background + hard offset shadow
- Secondary actions: white bg, black border, hard dark shadow on hover
- Active state: red accent border + red text
- Remove flex-1 spacer (moved to search)

Key changes:
```jsx
const base = 'px-4 py-2 font-bold text-base cursor-pointer transition-all border-2';
const styles = {
  primary:   'bg-[#dc2626] text-white border-[#dc2626] hover:bg-[#b91c1c] shadow-[3px_3px_0_#0f0d0a]',
  secondary: `bg-transparent text-white border-white hover:bg-white hover:text-[#0f0d0a] ${active ? 'bg-white text-[#dc2626] border-[#dc2626]' : ''}`,
  danger:    'bg-transparent text-[#dc2626] border-[#dc2626] hover:bg-[#dc2626] hover:text-white',
};
```

App title font: `font-family: 'Bricolage Grotesque'`, size `text-2xl`.

---

**Step 4: Canvas background**

In `Canvas.js`, update the root div background:
```jsx
<div
  id="canvas-export-target"
  style={{ backgroundColor: 'var(--bg-canvas)' }}
  ...
>
```

Update SVG background rect if present.

---

**Step 5: Node styling in `GraphNode.js`**

Theme nodes (planets):
- `backgroundColor: color` (theme's color — kept as-is for identity)
- `border: '3px solid #0f0d0a'` (black border instead of white)
- Hard shadow: `boxShadow: '6px 6px 0 ' + color + '88'`
- Font: Bricolage Grotesque via CSS variable (inherited from body)

Code nodes (satellites):
- `backgroundColor: '#ffffff'` (white fill)
- `color: '#0f0d0a'` text
- `border: '2px solid #0f0d0a'`
- `boxShadow: '4px 4px 0 #0f0d0a'`

---

**Step 6: Modals, PhysicsPanel, ContextMenu**

Each modal:
- Container: `bg-white border-2 border-[#0f0d0a] shadow-[8px_8px_0_#0f0d0a]`
- No `border-radius` on the container (squared corners)
- Confirm button: `bg-[#dc2626] text-white border-2 border-[#dc2626] shadow-[3px_3px_0_#0f0d0a]`
- Cancel/back: `bg-white text-[#0f0d0a] border-2 border-[#0f0d0a]`
- Headings: Bricolage Grotesque, `text-[#0f0d0a]`

---

**Step 7: Status bar in `App.js`**

```jsx
<div className="flex gap-6 px-4 py-2 border-t-2 text-base font-bold"
     style={{ backgroundColor: 'var(--bg-toolbar)', borderColor: '#0f0d0a', color: 'white' }}>
  <span><b style={{ color: 'white' }}>{codeCount}</b> codes</span>
  <span><b style={{ color: 'white' }}>{themeCount}</b> themes</span>
  <span><b style={{ color: '#dc2626' }}>{unassignedCount}</b> unassigned</span>
</div>
```

---

**Step 8: Run tests**

```bash
cd d:/thematic-analysis-app && npm test -- --watchAll=false && npm run test:e2e
```

Expected: all pass. Visual only — no behavioral changes.

---

**Step 9: Commit**

```bash
cd d:/thematic-analysis-app
git add public/index.html src/index.css src/components/Toolbar.js src/components/Canvas.js src/components/nodes/GraphNode.js src/components/QuoteTooltip.js src/components/modals/ src/components/PhysicsPanel.js src/components/ContextMenu.js src/App.js
git commit -m "feat: apply Neo-Brutalist redesign — Bricolage Grotesque, cream canvas, hard shadows"
```

---

**Step 10: Code review**

Use `superpowers-extended-cc:code-reviewer`.

---

### Task 10: Accessibility Pass

**Files:** All interactive components (Toolbar, GraphNode, Canvas, all modals, ContextMenu, PhysicsPanel)

**Goal:** Meet WCAG 2.1 AA. Audit every interactive element for proper semantics, ARIA, and keyboard nav.

---

**Step 1: Audit checklist**

For each file, verify:

| Check | Details |
|---|---|
| Semantic elements | `<button>` not `<div>` for all interactive elements |
| `aria-label` | Every node: `"[label] — [type] node"` |
| `aria-pressed` | Connect mode toggle, search filter toggles, Physics toggle |
| Modal trapping | Focus stays inside open modal; `aria-modal="true"`, `aria-labelledby` |
| `role="search"` | On search container in Toolbar |
| `aria-live="polite"` | Search result count |
| Close buttons | `aria-label="Close"` on all × buttons |
| Focus rings | `focus-visible` ring: `3px solid #dc2626`, `outline-offset: 2px` |
| Color contrast | All text ≥ 4.5:1 — use browser DevTools or axe |
| Keyboard canvas nav | Tab reaches nodes; Enter/Space activates; Escape closes menus |

---

**Step 2: Fix any issues found in the audit**

Common fixes:
- Any `<div onClick>` → `<button>`
- Any `<div tabIndex={0}>` without `role` → add `role="button"` or convert to `<button>`
- Missing `aria-label` on icon-only buttons in Toolbar → add descriptive labels
- Modal overlays: ensure clicking outside closes but Escape also works and focus returns to trigger

---

**Step 3: Add `focus-visible` global CSS**

In `src/index.css`:
```css
/* Accessible focus rings — visible on keyboard, hidden on mouse */
:focus-visible {
  outline: 3px solid #dc2626;
  outline-offset: 2px;
}

/* Suppress default for mouse users */
:focus:not(:focus-visible) {
  outline: none;
}
```

---

**Step 4: Run tests**

```bash
cd d:/thematic-analysis-app && npm test -- --watchAll=false && npm run test:e2e
```

Expected: all pass.

---

**Step 5: Commit**

```bash
cd d:/thematic-analysis-app
git add -A
git commit -m "feat: accessibility pass — ARIA, focus rings, keyboard nav, semantic HTML"
```

---

**Step 6: Code review**

Use `superpowers-extended-cc:code-reviewer`. This is the final review before the branch is ready to merge.

---

## Post-implementation

After all 10 tasks pass review:

```bash
cd d:/thematic-analysis-app
git log --oneline feature/ui-redesign ^master
```

Review the commit list, then open a PR or merge to master per team process.
