# Multi-View Phase 2: Sankey of Evidence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third view — a read-mostly `d3-sankey` "Sankey of Evidence" lens rendering sources → codes → (optional subthemes) → themes flows — alongside the existing Graph and Wall views.

**Architecture:** The Sankey is a pure projection of `GraphContext` state: a dependency-free transform (`sankeyTransform.js`, jest-safe with no d3 imports) converts `{nodes, edges}` into d3-sankey input with per-code value-1 links carrying highlight keys, and `SankeyView.js` lays it out inside a fixed 16:10 figure frame that doubles as the `canvas-export-target` for the existing PNG/PDF pipeline. No reducer or storage changes — Phase 1's v2 schema already covers everything this view reads.

**Tech Stack:** React 19 (CRA), d3-sankey (new dependency; d3 v7 already installed), Tailwind + inline styles, Jest unit tests, Playwright E2E.

**User decisions (already made):**
- Sankey is Phase 2 of the approved multi-view roadmap (design doc §3); Wall + view switcher + v2 storage already merged to master.
- Read-mostly lens: clicking a code opens CodeEditModal — the only edit affordance. Clicking a theme isolates its flow. Hover highlights the full path.
- Columns: sources → codes → themes, with an optional subthemes column toggle.
- Unassigned codes flow into an explicit "Unassigned" sink.
- Single-source themes get a grounding-warning glyph ("one loud interview" detector).
- `d3-sankey` is the new dependency.
- Export reuses the existing PNG/PDF pipeline at a fixed figure-friendly aspect ratio; empty state (no coded data) shows guidance.
- Ribbons use the theme palette at ~80% opacity; aria-labels go on sankey paths.
- Verify with `$env:CI="true"; npx react-scripts test --watchAll=false` (54 unit tests today) and `npx playwright test --reporter=list` (25 E2E tests today, needs port 3000 free). Existing tests stay green.
- Fresh worktree needs `npm ci` AND `npm install --no-save @playwright/test@1.59.1` (deliberately not in package.json).

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/utils/sankeyTransform.js` | Create | Pure transform: graph state → d3-sankey `{nodes, links}` + grounding warnings. **No d3 imports** — keeps it unit-testable under CRA's jest (d3 v7 is ESM-only and untransformed in jest). |
| `src/utils/sankeyTransform.test.js` | Create | 11 unit tests for the transform (54 → 65 total, 4 → 5 suites). |
| `src/components/sankey/SankeyView.js` | Create | The view: d3-sankey layout, SVG ribbons/nodes, hover highlight, theme isolation, code-click edit, tooltip, warning glyphs, subtheme toggle, empty state, fixed-aspect export frame. |
| `src/components/Toolbar.js` | Modify (~line 97) | Add `sankey` to the view-switcher array. Nothing else — `graphOnly` buttons already disable on any non-graph view. |
| `src/App.js` | Modify (~lines 25–34, 63, 439–462) | Import SankeyView, extend the view comment, add the render branch with `onEditCode`/`onImport` props. |
| `e2e/app.spec.js` | Modify (append) | Tests 26–28: empty state, render smoke + warning glyph, interactions (25 → 28 E2E). |
| `CLAUDE.md` | Modify | View state row, Key Files, commands test counts, architecture table. |
| `package.json` / `package-lock.json` | Modify | `d3-sankey` dependency. |

**Key invariants respected:**
- All state reads go through `useGraph()`; this feature dispatches nothing (read-mostly) except via the reused CodeEditModal.
- `id="canvas-export-target"` moves to the **figure frame** div inside SankeyView (not the outer panel div) so exports capture the fixed 16:10 figure. Only one element ever carries the id — Canvas/WallView/SankeyView are mutually exclusive mounts.
- No reducer changes → the "reducer cases must spread state" gotcha isn't triggered, and nothing new is persisted.

---

## Data-flow reference (read this before Tasks 2 and 4)

The current graph model, as it feeds the Sankey:

- **Code nodes** (`type: 'code'`) carry `source` (a free string from import, may be blank), `quote`, `primaryThemeId` (theme id or null), `color` (theme color when assigned, `#6b7280` gray when not).
- **Subthemes** (`type: 'subtheme'`) carry `primaryThemeId` → their parent theme. A code "assigned to a subtheme" has `primaryThemeId` pointing at the parent **theme**, plus an **edge** `{source: codeId, target: subthemeId}` (see `BULK_ASSIGN_THEME` in GraphContext.js:174).
- **Sources are not nodes** — the source column derives from distinct trimmed `code.source` strings. Blank sources bucket into a "No source" pseudo-source.
- Every code contributes **value-1 links along its entire path**, so ribbon thickness aggregates code counts naturally (d3-sankey stacks parallel links), and each link can carry the ids needed for single-thread hover highlighting.

---

## Task 1: Environment bootstrap + d3-sankey dependency

**Goal:** A fresh worktree that runs both test suites green at today's baseline (54 unit / 25 E2E) and has `d3-sankey` installed and committed.

**Files:**
- Modify: `package.json` (d3-sankey under dependencies)
- Modify: `package-lock.json`

**Acceptance Criteria:**
- [ ] `npm ci` and `npm install --no-save @playwright/test@1.59.1` completed without errors
- [ ] Baseline unit suite: 54 passed, 4 suites
- [ ] Baseline E2E suite: 25 passed (port 3000 free; Playwright auto-starts the dev server)
- [ ] `d3-sankey` appears in `package.json` dependencies and `require('d3-sankey')` resolves
- [ ] package.json + package-lock.json committed

**Verify:** `$env:CI="true"; npx react-scripts test --watchAll=false` → `Tests: 54 passed`; `npx playwright test --reporter=list` → `25 passed`

**Steps:**

- [ ] **Step 1: Install dependencies** (PowerShell, from the worktree root)

```powershell
npm ci
npm install --no-save "@playwright/test@1.59.1"
```

Note: `@playwright/test` is deliberately NOT in package.json — do not use `--save`. If Chromium is missing, also run `npx playwright install chromium`.

- [ ] **Step 2: Baseline unit tests**

Run: `$env:CI="true"; npx react-scripts test --watchAll=false`
Expected: `Test Suites: 4 passed, 4 total` / `Tests: 54 passed, 54 total`

- [ ] **Step 3: Baseline E2E tests** (port 3000 must be free)

Run: `npx playwright test --reporter=list`
Expected: `25 passed`

- [ ] **Step 4: Add d3-sankey**

```powershell
npm install d3-sankey
```

Expected result in `package.json` dependencies: `"d3-sankey": "^0.12.3"`.

- [ ] **Step 5: Sanity-check the module resolves**

Run: `node -e "const s = require('d3-sankey'); console.log(typeof s.sankey, typeof s.sankeyLinkHorizontal)"`
Expected: `function function`

- [ ] **Step 6: Commit**

```powershell
git add package.json package-lock.json
git commit -m "chore: add d3-sankey dependency for Sankey of Evidence view"
```

---

## Task 2: sankeyTransform.js — pure graph → sankey transform (TDD)

**Goal:** A dependency-free `buildSankeyData(nodes, edges, {includeSubthemes})` that produces d3-sankey-ready `{nodes, links}`, an explicit Unassigned sink, a "No source" bucket, optional subtheme routing, and single-source grounding warnings.

**Files:**
- Create: `src/utils/sankeyTransform.js`
- Test: `src/utils/sankeyTransform.test.js`

**Acceptance Criteria:**
- [ ] `isEmpty: true` when there are no code nodes; empty nodes/links arrays
- [ ] Assigned code with a source yields `source → code → theme` (2 links, value 1 each); codes sharing a source reuse one source node
- [ ] Unassigned codes (including dangling `primaryThemeId`) link into `UNASSIGNED_ID` sink
- [ ] Blank/whitespace `source` buckets into `NO_SOURCE_ID`
- [ ] `warnings` contains exactly the theme ids fed by a single source bucket
- [ ] With `includeSubthemes: true`, a code with an edge to a subtheme of its own theme routes `code → subtheme → theme`; other codes stay direct; subthemes of other themes are ignored
- [ ] Every link carries `codeId`, `themeKey`, `sourceLabel`, `subId` for hover highlighting
- [ ] No d3 imports anywhere in the file
- [ ] All 11 new tests pass; suite total 65

**Verify:** `$env:CI="true"; npx react-scripts test --watchAll=false` → `Test Suites: 5 passed` / `Tests: 65 passed`

**Steps:**

- [ ] **Step 1: Write the failing tests** — create `src/utils/sankeyTransform.test.js`:

```js
/**
 * sankeyTransform.test.js
 * Pure transform: graph state → d3-sankey {nodes, links} input.
 */
import { buildSankeyData, UNASSIGNED_ID, NO_SOURCE_ID } from './sankeyTransform';

const theme = (id, label, color = '#4f46e5') =>
  ({ id, type: 'theme', label, color, x: 0, y: 0 });
const code = (id, label, opts = {}) =>
  ({ id, type: 'code', label, quote: '', source: '', primaryThemeId: null, color: '#6b7280', x: 0, y: 0, ...opts });
const subtheme = (id, label, primaryThemeId, color = '#4f46e5') =>
  ({ id, type: 'subtheme', label, primaryThemeId, color, x: 0, y: 0 });
const edge = (source, target) => ({ id: `e-${source}-${target}`, source, target });

describe('buildSankeyData', () => {
  test('flags empty when there are no code nodes', () => {
    const out = buildSankeyData([theme('t1', 'Coping')], []);
    expect(out.isEmpty).toBe(true);
    expect(out.nodes).toEqual([]);
    expect(out.links).toEqual([]);
  });

  test('assigned code produces source → code → theme chain', () => {
    const out = buildSankeyData([
      theme('t1', 'Coping', '#059669'),
      code('c1', 'Social support', { source: 'Interview_01', primaryThemeId: 't1', color: '#059669' }),
    ], []);
    expect(out.isEmpty).toBe(false);
    expect(out.nodes.map(n => n.kind).sort()).toEqual(['code', 'source', 'theme']);
    expect(out.links).toHaveLength(2);
    expect(out.links[0]).toMatchObject({ target: 'c1', value: 1, themeKey: 't1', sourceLabel: 'Interview_01' });
    expect(out.links[1]).toMatchObject({ source: 'c1', target: 't1', value: 1, color: '#059669' });
  });

  test('codes sharing a source reuse one source node; theme aggregates by code count', () => {
    const out = buildSankeyData([
      theme('t1', 'Coping'),
      code('c1', 'A', { source: 'Interview_01', primaryThemeId: 't1' }),
      code('c2', 'B', { source: 'Interview_01', primaryThemeId: 't1' }),
    ], []);
    expect(out.nodes.filter(n => n.kind === 'source')).toHaveLength(1);
    expect(out.links.filter(l => l.target === 't1')).toHaveLength(2); // 2 units of ribbon thickness
  });

  test('unassigned code flows into the Unassigned sink', () => {
    const out = buildSankeyData([code('c1', 'Orphan', { source: 'Interview_01' })], []);
    expect(out.nodes.some(n => n.id === UNASSIGNED_ID && n.kind === 'unassigned')).toBe(true);
    expect(out.links).toContainEqual(expect.objectContaining({ source: 'c1', target: UNASSIGNED_ID, value: 1 }));
  });

  test('blank source lands in the "No source" bucket', () => {
    const out = buildSankeyData([code('c1', 'NoSrc', { source: '  ' })], []);
    expect(out.nodes.some(n => n.id === NO_SOURCE_ID && n.kind === 'source')).toBe(true);
    expect(out.links[0]).toMatchObject({ source: NO_SOURCE_ID, target: 'c1' });
  });

  test('warns on single-source themes only', () => {
    const out = buildSankeyData([
      theme('t1', 'One voice'),
      theme('t2', 'Grounded'),
      code('c1', 'A', { source: 'Interview_01', primaryThemeId: 't1' }),
      code('c2', 'B', { source: 'Interview_01', primaryThemeId: 't2' }),
      code('c3', 'C', { source: 'Interview_02', primaryThemeId: 't2' }),
    ], []);
    expect(out.warnings.has('t1')).toBe(true);
    expect(out.warnings.has('t2')).toBe(false);
  });

  test('subthemes off: code→subtheme edges are ignored', () => {
    const out = buildSankeyData([
      theme('t1', 'T'), subtheme('s1', 'S', 't1'),
      code('c1', 'A', { source: 'I1', primaryThemeId: 't1' }),
    ], [edge('c1', 's1')]);
    expect(out.nodes.some(n => n.kind === 'subtheme')).toBe(false);
    expect(out.links).toContainEqual(expect.objectContaining({ source: 'c1', target: 't1' }));
  });

  test('subthemes on: code routes source → code → subtheme → theme', () => {
    const out = buildSankeyData([
      theme('t1', 'T'), subtheme('s1', 'S', 't1'),
      code('c1', 'A', { source: 'I1', primaryThemeId: 't1' }),
    ], [edge('c1', 's1')], { includeSubthemes: true });
    const chain = out.links.map(l => `${l.source}→${l.target}`);
    expect(chain).toContain('c1→s1');
    expect(chain).toContain('s1→t1');
    expect(chain).not.toContain('c1→t1');
    expect(out.links.every(l => l.subId === 's1')).toBe(true); // whole thread hover-matches the subtheme
  });

  test('subthemes on: code without a subtheme edge stays direct', () => {
    const out = buildSankeyData([
      theme('t1', 'T'), subtheme('s1', 'S', 't1'),
      code('c1', 'A', { source: 'I1', primaryThemeId: 't1' }),
      code('c2', 'B', { source: 'I1', primaryThemeId: 't1' }),
    ], [edge('c1', 's1')], { includeSubthemes: true });
    const chain = out.links.map(l => `${l.source}→${l.target}`);
    expect(chain).toContain('c2→t1');
    expect(chain).not.toContain('c2→s1');
  });

  test('a subtheme belonging to a different theme is not used for routing', () => {
    const out = buildSankeyData([
      theme('t1', 'T1'), theme('t2', 'T2'), subtheme('s2', 'S2', 't2'),
      code('c1', 'A', { source: 'I1', primaryThemeId: 't1' }),
      code('c9', 'anchor', { source: 'I1', primaryThemeId: 't2' }),
    ], [edge('c1', 's2')], { includeSubthemes: true });
    const chain = out.links.map(l => `${l.source}→${l.target}`);
    expect(chain).toContain('c1→t1');
    expect(chain).not.toContain('c1→s2');
  });

  test('dangling primaryThemeId degrades to Unassigned', () => {
    const out = buildSankeyData([code('c1', 'A', { source: 'I1', primaryThemeId: 'ghost' })], []);
    expect(out.links).toContainEqual(expect.objectContaining({ source: 'c1', target: UNASSIGNED_ID }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `$env:CI="true"; npx react-scripts test --watchAll=false src/utils/sankeyTransform.test.js`
Expected: FAIL — `Cannot find module './sankeyTransform'`

- [ ] **Step 3: Write the implementation** — create `src/utils/sankeyTransform.js`:

```js
/**
 * sankeyTransform.js
 * ──────────────────────────────────────────────────────────────────────────
 * Pure transform: graph state → d3-sankey {nodes, links} input.
 * Columns: sources → codes → (subthemes, optional) → themes / Unassigned.
 *
 * Sources are not graph nodes — the source column derives from distinct
 * trimmed `code.source` strings; blank sources bucket into "No source".
 *
 * Every code contributes value-1 links along its whole path, so ribbon
 * thickness aggregates code counts per path (d3-sankey stacks parallel
 * links), and each link carries the ids needed for path-level hover
 * highlighting in SankeyView:
 *   codeId      — the code this link's unit of flow passes through
 *   themeKey    — destination theme id, or UNASSIGNED_ID
 *   sourceLabel — origin source-bucket label
 *   subId       — routing subtheme id, or null
 *
 * warnings: Set<themeId> of themes grounded in a single source bucket —
 * the "one loud interview" detector.
 *
 * NO d3 imports here: d3 v7 is ESM-only and CRA's jest doesn't transform
 * node_modules, so this module stays dependency-free to stay unit-testable.
 */

import { UNASSIGNED_COLOR } from '../context/GraphContext';

export const UNASSIGNED_ID = 'sankey:unassigned';
export const NO_SOURCE_ID = 'sankey:no-source';
export const NO_SOURCE_LABEL = 'No source';

export function buildSankeyData(nodes, edges, { includeSubthemes = false } = {}) {
  const codes = nodes.filter(n => n.type === 'code');
  if (codes.length === 0) {
    return { nodes: [], links: [], warnings: new Set(), isEmpty: true };
  }

  const themesById = new Map(nodes.filter(n => n.type === 'theme').map(n => [n.id, n]));
  const subthemesById = new Map(nodes.filter(n => n.type === 'subtheme').map(n => [n.id, n]));
  const codesById = new Map(codes.map(n => [n.id, n]));

  // code id → routing subtheme (first edge to a subtheme of the code's own theme)
  const subthemeForCode = new Map();
  if (includeSubthemes) {
    for (const e of edges) {
      if (subthemeForCode.has(e.source)) continue;
      const sub = subthemesById.get(e.target);
      const c = codesById.get(e.source);
      if (sub && c && c.primaryThemeId && sub.primaryThemeId === c.primaryThemeId) {
        subthemeForCode.set(e.source, sub);
      }
    }
  }

  const outNodes = [];
  const seen = new Set();
  const addNode = (n) => { if (!seen.has(n.id)) { seen.add(n.id); outNodes.push(n); } };
  const links = [];
  const themeSourceBuckets = new Map(); // themeId → Set<sourceLabel>

  for (const c of codes) {
    const sourceLabel = (c.source || '').trim() || NO_SOURCE_LABEL;
    const sourceId = sourceLabel === NO_SOURCE_LABEL ? NO_SOURCE_ID : `sankey:src:${sourceLabel}`;
    addNode({ id: sourceId, label: sourceLabel, kind: 'source', color: '#0f0d0a' });
    addNode({ id: c.id, label: c.label, kind: 'code', color: c.color, ref: c });

    // dangling primaryThemeId (theme deleted out from under it) degrades to Unassigned
    const t = c.primaryThemeId ? themesById.get(c.primaryThemeId) : null;
    const sub = t ? subthemeForCode.get(c.id) : null;
    const common = {
      value: 1,
      codeId: c.id,
      themeKey: t ? t.id : UNASSIGNED_ID,
      sourceLabel,
      subId: sub ? sub.id : null,
    };

    links.push({ source: sourceId, target: c.id, color: t ? t.color : UNASSIGNED_COLOR, ...common });

    if (t) {
      addNode({ id: t.id, label: t.label, kind: 'theme', color: t.color, ref: t });
      if (!themeSourceBuckets.has(t.id)) themeSourceBuckets.set(t.id, new Set());
      themeSourceBuckets.get(t.id).add(sourceLabel);
      if (sub) {
        addNode({ id: sub.id, label: sub.label, kind: 'subtheme', color: sub.color, ref: sub });
        links.push({ source: c.id, target: sub.id, color: t.color, ...common });
        links.push({ source: sub.id, target: t.id, color: t.color, ...common });
      } else {
        links.push({ source: c.id, target: t.id, color: t.color, ...common });
      }
    } else {
      addNode({ id: UNASSIGNED_ID, label: 'Unassigned', kind: 'unassigned', color: UNASSIGNED_COLOR });
      links.push({ source: c.id, target: UNASSIGNED_ID, color: UNASSIGNED_COLOR, ...common });
    }
  }

  const warnings = new Set();
  for (const [themeId, buckets] of themeSourceBuckets) {
    if (buckets.size === 1) warnings.add(themeId);
  }

  return { nodes: outNodes, links, warnings, isEmpty: false };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `$env:CI="true"; npx react-scripts test --watchAll=false`
Expected: `Test Suites: 5 passed, 5 total` / `Tests: 65 passed, 65 total`

- [ ] **Step 5: Commit**

```powershell
git add src/utils/sankeyTransform.js src/utils/sankeyTransform.test.js
git commit -m "feat: pure sankey transform - sources/codes/themes flows, unassigned sink, grounding warnings"
```

---

## Task 3: View switcher + SankeyView shell (empty state, fixed-aspect export frame)

**Goal:** The toolbar offers a third "Sankey" view that mounts a SankeyView shell — empty-state guidance when no codes exist, and an empty fixed-16:10 figure frame (carrying `id="canvas-export-target"`) when data exists.

**Files:**
- Create: `src/components/sankey/SankeyView.js`
- Modify: `src/components/Toolbar.js:97` (switcher array)
- Modify: `src/App.js:26-34` (import), `src/App.js:61-63` (view comment), `src/App.js:439-462` (render branch)
- Test: `e2e/app.spec.js` (append test 26)

**Acceptance Criteria:**
- [ ] Toolbar shows Wall · Graph · Sankey; clicking Sankey sets `aria-pressed="true"` and mounts SankeyView
- [ ] Graph-only actions (Connect, zoom, Fit View, Align, Physics) are disabled on the Sankey view (existing `graphOnly` mechanism — no Toolbar logic changes beyond the array)
- [ ] With no codes: empty-state box with guidance text and an "⬆ Import Data" button that opens ImportModal
- [ ] With codes: a white, hard-shadowed figure frame at exactly 16:10, centered, sized to fit the panel, carrying `id="canvas-export-target"`
- [ ] E2E test 26 passes; existing 25 E2E tests still pass

**Verify:** `npx playwright test -g "Sankey view shows empty-state" --reporter=list` → `1 passed`

**Steps:**

- [ ] **Step 1: Add the switcher entry** — in `src/components/Toolbar.js`, replace:

```js
        {[['wall', '▦ Wall'], ['graph', '☄ Graph']].map(([key, label]) => (
```

with:

```js
        {[['wall', '▦ Wall'], ['graph', '☄ Graph'], ['sankey', '⇶ Sankey']].map(([key, label]) => (
```

Also update the `view` prop docs at the top of the file: `view {'wall'|'graph'|'sankey'}`.

- [ ] **Step 2: Create the shell** — `src/components/sankey/SankeyView.js`:

```jsx
/**
 * SankeyView.js
 * ──────────────────────────────────────────────────────────────────────────
 * Sankey of Evidence — read-mostly lens on the graph:
 *   sources → codes → (subthemes, optional) → themes / Unassigned.
 *
 * The figure renders inside a fixed 16:10 frame (FIG_W × FIG_H viewBox)
 * centered in the panel, so PNG/PDF export always yields a figure-friendly
 * aspect ratio. The frame div carries id="canvas-export-target" — the shared
 * export id (Canvas / WallView / SankeyView are mutually exclusive mounts).
 *
 * PROPS:
 *   onEditCode {fn(nodeId)} — open CodeEditModal (the only edit affordance)
 *   onImport   {fn}         — open ImportModal from the empty state
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useGraph } from '../../context/GraphContext';
import { buildSankeyData } from '../../utils/sankeyTransform';

const FIG_W = 1280;
const FIG_H = 800; // 16:10 — fixed figure aspect ratio for export

export default function SankeyView({ onEditCode, onImport }) {
  const { nodes, edges } = useGraph();
  const wrapRef = useRef(null);
  const [frame, setFrame] = useState({ w: 960, h: 600 });

  // Fit the fixed-ratio figure inside the available panel space
  useEffect(() => {
    function measure() {
      const el = wrapRef.current;
      if (!el) return;
      const availW = el.clientWidth - 48;
      const availH = el.clientHeight - 48;
      const w = Math.max(320, Math.min(availW, availH * (FIG_W / FIG_H)));
      setFrame({ w, h: w * (FIG_H / FIG_W) });
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const data = useMemo(
    () => buildSankeyData(nodes, edges, { includeSubthemes: false }),
    [nodes, edges]
  );

  return (
    <div
      ref={wrapRef}
      className="flex-1 relative flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: 'var(--bg-canvas)' }}
    >
      {data.isEmpty ? (
        <div className="text-center max-w-md p-8 border-2 border-[#0f0d0a] bg-white shadow-[8px_8px_0_#0f0d0a]">
          <p className="text-xl font-bold mb-3">Nothing to chart yet</p>
          <p className="text-base mb-5" style={{ color: '#6b6560' }}>
            The Sankey shows how sources flow through codes into themes. Import
            a CSV/Excel of coded excerpts, or add codes and connect them to
            themes in the Graph view.
          </p>
          <button
            onClick={onImport}
            className="px-4 py-2 font-bold text-base cursor-pointer border-2 bg-[#dc2626] text-white border-[#dc2626] hover:bg-[#b91c1c] shadow-[3px_3px_0_#0f0d0a]"
          >
            ⬆ Import Data
          </button>
        </div>
      ) : (
        <div
          id="canvas-export-target"
          className="relative bg-white border-2 border-[#0f0d0a] shadow-[8px_8px_0_#0f0d0a]"
          style={{ width: frame.w, height: frame.h }}
        >
          <svg width="100%" height="100%" viewBox={`0 0 ${FIG_W} ${FIG_H}`} preserveAspectRatio="xMidYMid meet" />
        </div>
      )}
    </div>
  );
}
```

(`onEditCode` is unused until Task 5 — keep it in the signature now so App wiring is done once. CRA lint doesn't flag unused destructured props.)

- [ ] **Step 3: Wire App.js.** Three edits:

3a. Add the import after the WallView import (`src/App.js:26`):

```js
import SankeyView   from './components/sankey/SankeyView';
```

3b. Update the view-state comment and annotation (`src/App.js:61-63`):

```js
  // ── UI state ────────────────────────────────────────────────────────────────
  // Default stays 'graph'; flipping the default is a deliberate
  // post-validation follow-up (design doc §1).
  const [view,          setView]          = useState('graph'); // 'wall' | 'graph' | 'sankey'
```

3c. Replace the two-way render ternary (`src/App.js:439-462`) with a three-way branch — the Canvas and WallView JSX stays byte-for-byte identical, only the surrounding ternary and the new SankeyView branch change:

```jsx
        {view === 'graph' ? (
          <Canvas
            connectMode={connectMode}
            physicsParams={physicsParams}
            onContextMenu={handleContextMenu}
            onFitReady={(fn) => { fitViewFn.current = fn; }}
            onAlignReady={(fn) => { alignTriggerRef.current = fn; }}
            onZoomReady={(fn) => { zoomByFn.current = fn; }}
            searchQuery={searchQuery}
            searchFilters={searchFilters}
            focusThemeId={focusThemeId}
            onExitFocus={() => setFocusThemeId(null)}
            collapsedNodeIds={collapsedNodeIds}
            selectedNodeIds={selectedNodeIds}
            onShiftClickNode={handleShiftClickNode}
            onClearSelection={() => setSelectedNodeIds(new Set())}
            onScreenToWorldReady={(fn) => { screenToWorldRef.current = fn; }}
          />
        ) : view === 'wall' ? (
          <WallView
            onContextMenu={handleContextMenu}
            onCropRectReady={(fn) => { wallCropRef.current = fn; }}
          />
        ) : (
          <SankeyView
            onEditCode={setCodeEditId}
            onImport={() => setImportOpen(true)}
          />
        )}
```

- [ ] **Step 4: Write the E2E test** — append to `e2e/app.spec.js`:

```js
// ── 26. Sankey view — switcher + empty state ────────────────────────────────

test('26 — Sankey view shows empty-state guidance when no codes exist', async ({ page }) => {
  await page.getByRole('button', { name: /Sankey/ }).click();
  await expect(page.getByRole('button', { name: /Sankey/ })).toHaveAttribute('aria-pressed', 'true');

  // Empty-state guidance with a working Import affordance
  await expect(page.getByText('Nothing to chart yet')).toBeVisible();
  await expect(page.getByRole('button', { name: /Connect/ })).toBeDisabled();
  await page.getByRole('button', { name: /Import Data/ }).click();
  await expect(page.getByText('Import Data', { exact: true })).toBeVisible(); // ImportModal title
});
```

Note: the ImportModal heading is the text `Import Data` (see test 9). The empty-state button is `⬆ Import Data` — `getByRole('button', ...)` and `getByText(..., { exact: true })` keep the two distinct.

- [ ] **Step 5: Run the new test + the neighbors it could regress**

Run: `npx playwright test -g "Sankey view shows empty-state" --reporter=list`
Expected: `1 passed`
Run: `npx playwright test -g "view switcher" --reporter=list`
Expected: `1 passed` (test 22 uses `/Graph/` and `/Wall/` name regexes — unaffected by the new button)

- [ ] **Step 6: Commit**

```powershell
git add src/components/sankey/SankeyView.js src/components/Toolbar.js src/App.js e2e/app.spec.js
git commit -m "feat: Sankey view switcher entry, empty state, fixed 16:10 export frame"
```

---

## Task 4: Static Sankey rendering — layout, ribbons, labels, headers

**Goal:** With data present, the figure renders the full d3-sankey diagram: column headers, ribbons in theme colors at 80% opacity with aria-labels, node bars, and side labels.

**Files:**
- Modify: `src/components/sankey/SankeyView.js`

**Acceptance Criteria:**
- [ ] Ribbons render as `sankeyLinkHorizontal` paths, `stroke = link.color`, `strokeOpacity = 0.8`, width = layout width (min 1px)
- [ ] Every ribbon path has `role="img"` and an aria-label naming both endpoints
- [ ] Node bars: sources near-black, codes/themes/Unassigned in their node color, 1px near-black outline
- [ ] Labels: left-half nodes label to the right of the bar, right-half to the left (standard sankey rule); theme labels bold
- [ ] Column headers (SOURCES / CODES / THEMES) derived from actual layout column x-positions
- [ ] `buildSankeyData` output is never mutated — d3-sankey receives copies
- [ ] Unit + existing E2E suites stay green

**Verify:** `$env:CI="true"; npx react-scripts test --watchAll=false` → `65 passed`; then `npm start` + switch to Sankey after importing `docs/samples/thematic-import-sample.csv` shows 5 sources, 10 codes, 7 themes + Unassigned (manual smoke; scripted in Task 7's E2E)

**Steps:**

- [ ] **Step 1: Add the d3-sankey imports and layout constants** — in `SankeyView.js`, extend the imports:

```js
import { sankey, sankeyLinkHorizontal, sankeyJustify } from 'd3-sankey';
```

and below the `FIG_H` constant add:

```js
const MARGIN = { top: 64, right: 210, bottom: 28, left: 210 };
const RIBBON_OPACITY = 0.8; // design §5: theme palette at ~80% opacity
```

- [ ] **Step 2: Add the layout + columns memos** — inside the component, directly after the `data` memo:

```js
  const layout = useMemo(() => {
    if (data.isEmpty) return null;
    const generator = sankey()
      .nodeId(d => d.id)
      .nodeWidth(18)
      .nodePadding(14)
      .nodeAlign(sankeyJustify)
      .extent([[MARGIN.left, MARGIN.top], [FIG_W - MARGIN.right, FIG_H - MARGIN.bottom]]);
    // d3-sankey mutates its input — feed it copies, keep `data` pure
    return generator({
      nodes: data.nodes.map(n => ({ ...n })),
      links: data.links.map(l => ({ ...l })),
    });
  }, [data]);

  // Unique node x-positions, sorted → header placement per rendered column
  const columns = useMemo(() => {
    if (!layout) return [];
    return [...new Set(layout.nodes.map(n => Math.round(n.x0)))].sort((a, b) => a - b);
  }, [layout]);
  const headerLabels = ['SOURCES', 'CODES', 'THEMES'];
```

(`headerLabels` becomes conditional on the subtheme toggle in Task 6.)

- [ ] **Step 3: Render the diagram** — replace the self-closing `<svg ... />` inside the figure frame with:

```jsx
          <svg width="100%" height="100%" viewBox={`0 0 ${FIG_W} ${FIG_H}`} preserveAspectRatio="xMidYMid meet">
            {/* column headers */}
            {columns.map((x, i) => headerLabels[i] && (
              <text
                key={x}
                x={x + 9}
                y={34}
                textAnchor="middle"
                fontSize="15"
                fontWeight="700"
                letterSpacing="0.1em"
                fill="#6b6560"
              >
                {headerLabels[i]}
              </text>
            ))}

            {/* ribbons */}
            <g fill="none">
              {layout.links.map((l, i) => (
                <path
                  key={`${l.codeId}-${l.source.id}-${l.target.id}-${i}`}
                  d={sankeyLinkHorizontal()(l)}
                  stroke={l.color}
                  strokeWidth={Math.max(1, l.width)}
                  strokeOpacity={RIBBON_OPACITY}
                  role="img"
                  aria-label={`${l.source.label} flows into ${l.target.label}`}
                  style={{ transition: 'stroke-opacity 0.15s' }}
                />
              ))}
            </g>

            {/* node bars + labels */}
            {layout.nodes.map(n => {
              const labelOnRight = n.x0 < FIG_W / 2;
              return (
                <g key={n.id}>
                  <rect
                    x={n.x0}
                    y={n.y0}
                    width={n.x1 - n.x0}
                    height={Math.max(1, n.y1 - n.y0)}
                    fill={n.kind === 'source' ? '#0f0d0a' : n.color}
                    stroke="#0f0d0a"
                    strokeWidth="1"
                  />
                  <text
                    x={labelOnRight ? n.x1 + 8 : n.x0 - 8}
                    y={(n.y0 + n.y1) / 2}
                    dy="0.35em"
                    textAnchor={labelOnRight ? 'start' : 'end'}
                    fontSize="14"
                    fontWeight={n.kind === 'theme' ? 700 : 500}
                    fill="#0f0d0a"
                  >
                    {n.label}
                  </text>
                </g>
              );
            })}
          </svg>
```

Note: after layout runs, `l.source`/`l.target` are node **objects** (d3-sankey resolves the id strings), so `l.source.label` is valid. `layout` is non-null whenever this branch renders (the same `data.isEmpty` ternary guards both).

- [ ] **Step 4: Run the unit suite (guards against accidental transform mutation)**

Run: `$env:CI="true"; npx react-scripts test --watchAll=false`
Expected: `Tests: 65 passed`

- [ ] **Step 5: Manual smoke** — `npm start`, import `docs/samples/thematic-import-sample.csv`, switch to Sankey. Expected: 5 source bars (Interview_01…05) on the left, 10 code bars center, 7 theme bars + gray "Unassigned" on the right; ribbons colored per theme.

- [ ] **Step 6: Commit**

```powershell
git add src/components/sankey/SankeyView.js
git commit -m "feat: static sankey rendering - ribbons at 80% opacity, aria-labels, column headers"
```

---

## Task 5: Interactivity — hover path highlight, quote tooltip, theme isolation, code editing

**Goal:** Hovering any node or ribbon highlights the full path of the code(s) flowing through it; hovering a code shows the reused QuoteTooltip; clicking a theme isolates its flow (Escape or a pill exits); clicking a code opens CodeEditModal.

**Files:**
- Modify: `src/components/sankey/SankeyView.js`
- Test: `e2e/app.spec.js` (append test 28 — numbered 28 because 27, the post-import render smoke, needs Task 6's glyph and lands in Task 7)

**Acceptance Criteria:**
- [ ] Hovering a source / code / subtheme / theme / Unassigned bar brightens its matching ribbons (opacity 0.95) and dims the rest (0.12); non-path node bars dim to 0.25
- [ ] Hovering a code bar shows QuoteTooltip with the code's quote/source/color, tracking the cursor; leaving hides it
- [ ] Clicking a theme bar isolates its flow: non-matching ribbons drop to opacity 0.06; clicking it again, pressing Escape, or clicking the "✕ Show All Themes" pill restores everything
- [ ] Clicking a code bar calls `onEditCode(code.id)` → CodeEditModal opens
- [ ] Theme and code bars have `role="button"`, descriptive aria-labels, `tabIndex={0}`, and Enter activates them
- [ ] E2E test 28 passes; suites stay green

**Verify:** `npx playwright test -g "Sankey code click opens edit modal" --reporter=list` → `1 passed`

**Steps:**

- [ ] **Step 1: Add the highlight helpers** — in `SankeyView.js`, above the `export default` line, add module-level functions:

```js
/** Does this link belong to the hovered/isolated selection? */
function linkMatches(l, probe) {
  if (!probe) return false;
  if (probe.codeId) return l.codeId === probe.codeId;
  if (probe.subId) return l.subId === probe.subId;
  if (probe.themeKey) return l.themeKey === probe.themeKey;
  if (probe.sourceLabel) return l.sourceLabel === probe.sourceLabel;
  return false;
}

/** What a hover on this node should highlight */
function hoverProbeFor(n) {
  switch (n.kind) {
    case 'code':       return { codeId: n.id };
    case 'subtheme':   return { subId: n.id };
    case 'theme':      return { themeKey: n.id };
    case 'unassigned': return { themeKey: n.id }; // links into the sink carry themeKey = UNASSIGNED_ID
    case 'source':     return { sourceLabel: n.label };
    default:           return null;
  }
}
```

- [ ] **Step 2: Add interaction state + imports.** Extend the React import line's hooks if needed (already has useState/useEffect/useMemo/useRef) and add:

```js
import QuoteTooltip from '../QuoteTooltip';
```

Inside the component, after the `frame` state:

```js
  const [hover, setHover] = useState(null);              // probe object or null
  const [isolatedThemeId, setIsolatedThemeId] = useState(null);
  const [tooltip, setTooltip] = useState(null);          // { x, y, node } or null
```

- [ ] **Step 3: Add the derived-highlight memo, opacity helpers, and handlers** — after the `columns` memo:

```js
  const probe = hover ?? (isolatedThemeId ? { themeKey: isolatedThemeId } : null);
  const litNodeIds = useMemo(() => {
    if (!layout || !probe) return null;
    const lit = new Set();
    for (const l of layout.links) {
      if (linkMatches(l, probe)) { lit.add(l.source.id); lit.add(l.target.id); }
    }
    return lit;
  }, [layout, probe]);

  function linkOpacity(l) {
    if (isolatedThemeId && l.themeKey !== isolatedThemeId) return 0.06;
    if (hover) return linkMatches(l, hover) ? 0.95 : 0.12;
    return RIBBON_OPACITY;
  }

  function nodeOpacity(n) {
    if (!litNodeIds) return 1;
    return litNodeIds.has(n.id) ? 1 : 0.25;
  }

  function handleNodeClick(n) {
    if (n.kind === 'theme') setIsolatedThemeId(prev => (prev === n.id ? null : n.id));
    else if (n.kind === 'code') onEditCode?.(n.id);
  }

  function handleCodeMouseMove(n, e) {
    const rect = wrapRef.current.getBoundingClientRect();
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, node: n.ref });
  }
```

And an Escape-exits-isolation effect after the measure effect (listener installed only while isolating — same guard discipline as the modal Escape convention):

```js
  // Escape exits flow isolation
  useEffect(() => {
    if (!isolatedThemeId) return;
    function onKey(e) { if (e.key === 'Escape') setIsolatedThemeId(null); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isolatedThemeId]);
```

- [ ] **Step 4: Wire the SVG.** In the ribbon `<path>`, replace `strokeOpacity={RIBBON_OPACITY}` with `strokeOpacity={linkOpacity(l)}`. Replace the node-render block from Task 4 (`{layout.nodes.map(n => {` through its closing `})}`) with:

```jsx
            {layout.nodes.map(n => {
              const clickable = n.kind === 'theme' || n.kind === 'code';
              const labelOnRight = n.x0 < FIG_W / 2;
              return (
                <g
                  key={n.id}
                  opacity={nodeOpacity(n)}
                  onMouseEnter={() => setHover(hoverProbeFor(n))}
                  onMouseLeave={() => { setHover(null); setTooltip(null); }}
                  onMouseMove={n.kind === 'code' ? (e) => handleCodeMouseMove(n, e) : undefined}
                  onClick={clickable ? () => handleNodeClick(n) : undefined}
                  style={{ cursor: clickable ? 'pointer' : 'default', transition: 'opacity 0.15s' }}
                >
                  <rect
                    x={n.x0}
                    y={n.y0}
                    width={n.x1 - n.x0}
                    height={Math.max(1, n.y1 - n.y0)}
                    fill={n.kind === 'source' ? '#0f0d0a' : n.color}
                    stroke="#0f0d0a"
                    strokeWidth="1"
                    role={clickable ? 'button' : undefined}
                    aria-label={
                      n.kind === 'code' ? `Edit code ${n.label}`
                        : n.kind === 'theme' ? `Isolate theme ${n.label}`
                        : undefined
                    }
                    tabIndex={clickable ? 0 : undefined}
                    onKeyDown={clickable ? (e) => { if (e.key === 'Enter') handleNodeClick(n); } : undefined}
                  />
                  <text
                    x={labelOnRight ? n.x1 + 8 : n.x0 - 8}
                    y={(n.y0 + n.y1) / 2}
                    dy="0.35em"
                    textAnchor={labelOnRight ? 'start' : 'end'}
                    fontSize="14"
                    fontWeight={n.kind === 'theme' ? 700 : 500}
                    fill="#0f0d0a"
                  >
                    {n.label}
                  </text>
                </g>
              );
            })}
```

- [ ] **Step 5: Add the isolation pill and the tooltip.** Inside the figure-frame div, after the `</svg>` closing tag:

```jsx
          {/* exit flow isolation */}
          {isolatedThemeId && (
            <button
              onClick={() => setIsolatedThemeId(null)}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 font-bold text-base border-2 border-[#0f0d0a] bg-[#0f0d0a] text-white cursor-pointer"
            >
              ✕ Show All Themes
            </button>
          )}
```

Then, still inside the **outer** wrap div (as its last child, after the `{data.isEmpty ? ... : ...}` ternary), render the reused tooltip:

```jsx
      {/* reused quote tooltip on code hover (positions relative to the wrap div) */}
      <QuoteTooltip
        visible={!!tooltip}
        x={tooltip?.x ?? 0}
        y={tooltip?.y ?? 0}
        code={tooltip?.node?.label ?? ''}
        quote={tooltip?.node?.quote ?? ''}
        source={tooltip?.node?.source ?? ''}
        color={tooltip?.node?.color ?? '#0f0d0a'}
      />
```

(`n.ref` is the original code node carried through by the transform, so `quote`/`source` come straight from state.)

- [ ] **Step 6: Write E2E test 28** — append to `e2e/app.spec.js`:

```js
// ── 28. Sankey interactions ─────────────────────────────────────────────────

test('28 — Sankey code click opens edit modal; theme click isolates flow', async ({ page }) => {
  // Seed: theme + code, connected (same flow as test 4)
  await page.getByRole('button', { name: /Add Theme/i }).click();
  await page.getByRole('button', { name: /Add Code/i }).click();
  await page.getByRole('button', { name: /Connect/i }).click();
  const codeNode  = page.locator('.nodes-layer > div').filter({ hasNotText: /✓/ }).first();
  const themeNode = page.locator('[role="button"][aria-label*="theme"]').first();
  await codeNode.click({ force: true });
  await themeNode.click({ force: true });
  await page.getByRole('button', { name: /Cancel Connect/i }).click();

  await page.getByRole('button', { name: /Sankey/ }).click();

  // Theme isolation toggles on and off via the pill
  await page.getByRole('button', { name: /Isolate theme/ }).click();
  await expect(page.getByRole('button', { name: /Show All Themes/ })).toBeVisible();
  await page.getByRole('button', { name: /Show All Themes/ }).click();
  await expect(page.getByRole('button', { name: /Show All Themes/ })).not.toBeVisible();

  // Code click opens the edit modal
  await page.getByRole('button', { name: /Edit code/ }).click();
  await expect(page.getByText('Edit Code Node')).toBeVisible();
});
```

- [ ] **Step 7: Run the new test**

Run: `npx playwright test -g "Sankey code click opens edit modal" --reporter=list`
Expected: `1 passed`

- [ ] **Step 8: Commit**

```powershell
git add src/components/sankey/SankeyView.js e2e/app.spec.js
git commit -m "feat: sankey interactivity - path highlight, quote tooltip, theme isolation, code editing"
```

---

## Task 6: Grounding warnings + subtheme column toggle

**Goal:** Single-source themes display a ⚠ glyph with an explanatory title, and a toggle (visible only when subthemes exist) inserts the subtheme column.

**Files:**
- Modify: `src/components/sankey/SankeyView.js`

**Acceptance Criteria:**
- [ ] A theme whose codes all come from one source bucket renders `⚠ <label>` with a `<title>` explaining the warning; multi-source themes render plain labels
- [ ] "Subthemes: On/Off" toggle appears top-right of the figure only when any subtheme node exists, with `aria-pressed`
- [ ] Toggling On re-lays the diagram with a SUBTHEMES header column; codes routed through subthemes show 3-link chains; hover on a subtheme highlights every thread through it (via `subId`)
- [ ] Toggle defaults to Off; unit + E2E suites stay green

**Verify:** `$env:CI="true"; npx react-scripts test --watchAll=false` → `65 passed`; manual: seed a theme + subtheme + assigned code, toggle On, see the 4-column layout

**Steps:**

- [ ] **Step 1: Add the toggle state and feed it to the transform.** In the component, next to the other state:

```js
  const [includeSubthemes, setIncludeSubthemes] = useState(false);
  const hasSubthemes = nodes.some(n => n.type === 'subtheme');
```

Replace the `data` memo's fixed option with the state:

```js
  const data = useMemo(
    () => buildSankeyData(nodes, edges, { includeSubthemes }),
    [nodes, edges, includeSubthemes]
  );
```

- [ ] **Step 2: Make the headers column-count aware.** Replace the fixed `headerLabels` const from Task 4 with:

```js
  const headerLabels = columns.length === 4
    ? ['SOURCES', 'CODES', 'SUBTHEMES', 'THEMES']
    : ['SOURCES', 'CODES', 'THEMES'];
```

(4 rendered columns can only occur when subtheme routing is active; with the toggle off — or on but with no routed codes — the transform emits no subtheme nodes and the layout has 3 columns.)

- [ ] **Step 3: Add the warning glyph.** In the node-render block, add before the `return`:

```js
              const warn = n.kind === 'theme' && data.warnings.has(n.id);
```

and replace the label `<text>` content `{n.label}` with:

```jsx
                    {warn ? `⚠ ${n.label}` : n.label}
                    {warn && <title>Grounded in a single source — consider whether this theme rests on one voice</title>}
```

- [ ] **Step 4: Add the toggle button.** Inside the figure-frame div, after the isolation pill block:

```jsx
          {/* optional subtheme column */}
          {hasSubthemes && (
            <button
              onClick={() => setIncludeSubthemes(v => !v)}
              aria-pressed={includeSubthemes}
              className="absolute top-3 right-3 px-3 py-1.5 text-sm font-bold border-2 border-[#0f0d0a] cursor-pointer"
              style={{
                backgroundColor: includeSubthemes ? '#0f0d0a' : '#ffffff',
                color: includeSubthemes ? '#ffffff' : '#0f0d0a',
              }}
            >
              Subthemes: {includeSubthemes ? 'On' : 'Off'}
            </button>
          )}
```

- [ ] **Step 5: Run the unit suite**

Run: `$env:CI="true"; npx react-scripts test --watchAll=false`
Expected: `Tests: 65 passed`

- [ ] **Step 6: Manual smoke** — `npm start`: add a theme, right-click it → Add Subtheme (save it), add a code, connect code → subtheme in Graph view. Switch to Sankey: toggle appears; On shows SOURCES · CODES · SUBTHEMES · THEMES with the code routed through the subtheme; the theme (single "No source" bucket) shows the ⚠ glyph.

- [ ] **Step 7: Commit**

```powershell
git add src/components/sankey/SankeyView.js
git commit -m "feat: sankey grounding warnings and optional subtheme column toggle"
```

---

## Task 7: Sankey render smoke E2E, full-suite verification, docs

**Goal:** Add the post-import Sankey render smoke E2E test, prove the full unit suite (65 tests, 5 suites) and full E2E suite (28 tests) pass with all pre-existing tests green, and update CLAUDE.md.

> **USER-ORDERED GATE — NON-SKIPPABLE.** This task was requested by the user in the current conversation. It MUST NOT be closed by walking around it, by declaring it "verified inline", or by substituting a cheaper check. Close only after every item in `acceptanceCriteria` has been re-validated independently, with output captured.

**Files:**
- Test: `e2e/app.spec.js` (append test 27)
- Modify: `CLAUDE.md`

**Acceptance Criteria:**
- [ ] E2E test 27 passes: after importing the sample CSV, the Sankey renders exactly 20 aria-labeled ribbon paths (10 source→code + 9 code→theme + 1 code→Unassigned), column headers, the Unassigned sink, and a ⚠-glyphed theme
- [ ] Full unit suite output captured: `Test Suites: 5 passed` / `Tests: 65 passed` — no pre-existing test broken
- [ ] Full E2E suite output captured: `28 passed` — no pre-existing test broken
- [ ] `npm run build` completes without errors (CI treats warnings as errors — catches unused imports)
- [ ] CLAUDE.md updated: view row `'wall'|'graph'|'sankey'`, Key Files entries for `sankey/SankeyView.js` + `sankeyTransform.js`, test counts (65 unit / 28 E2E), d3-sankey in the architecture table

**Verify:** `$env:CI="true"; npx react-scripts test --watchAll=false` → `Tests: 65 passed, 65 total`; `npx playwright test --reporter=list` → `28 passed`; `npm run build` → `Compiled successfully`

**Steps:**

- [ ] **Step 1: Write E2E test 27** — append to `e2e/app.spec.js` (between the existing tests and test 28 if you prefer numeric order; Playwright doesn't care):

```js
// ── 27. Sankey render smoke after import ────────────────────────────────────

test('27 — Sankey renders source→code→theme ribbons after CSV import', async ({ page }) => {
  // Import the sample CSV (same flow as test 9)
  await page.getByRole('button', { name: /Import/i }).click();
  const csvPath = path.resolve(__dirname, '..', 'docs', 'samples', 'thematic-import-sample.csv');
  await page.locator('input[type="file"]').setInputFiles(csvPath);
  await expect(page.getByText('Preview Import')).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: /Confirm Import/i }).click();
  await expect(page.getByText('Preview Import')).not.toBeVisible({ timeout: 3000 });

  await page.getByRole('button', { name: /Sankey/ }).click();

  // 10 codes → 10 source→code links, 9 code→theme, 1 code→Unassigned = 20 ribbons
  const ribbons = page.locator('#canvas-export-target svg path[role="img"]');
  await expect(ribbons).toHaveCount(20);

  // Column headers and the explicit Unassigned sink — scope to the figure:
  // unscoped getByText would collide with the status bar ("7 themes",
  // "1 unassigned") under Playwright's substring/case-insensitive matching.
  const figure = page.locator('#canvas-export-target');
  await expect(figure.getByText('SOURCES')).toBeVisible();
  await expect(figure.getByText('THEMES', { exact: true })).toBeVisible();
  await expect(figure.getByText('Unassigned', { exact: true })).toBeVisible();

  // Every sample theme has exactly one code from one interview → grounding glyph
  await expect(figure.getByText(/⚠ Anxiety responses/)).toBeVisible();
});
```

- [ ] **Step 2: Run the new test**

Run: `npx playwright test -g "renders source" --reporter=list`
Expected: `1 passed`

- [ ] **Step 3: Full unit suite — capture output**

Run: `$env:CI="true"; npx react-scripts test --watchAll=false`
Expected (verbatim tail): `Test Suites: 5 passed, 5 total` / `Tests: 65 passed, 65 total`

- [ ] **Step 4: Full E2E suite — capture output** (port 3000 free)

Run: `npx playwright test --reporter=list`
Expected: `28 passed` — every test 1–25 from before this plan still listed as passed.

- [ ] **Step 5: Production build sanity**

Run: `npm run build`
Expected: `Compiled successfully.` (catches unused-import warnings that CRA promotes to errors under CI)

- [ ] **Step 6: Update CLAUDE.md** — four precise edits:

6a. Essential Commands block, test lines:

```
npm test               # Jest unit tests (65 tests, 5 suites) — watchAll=false for CI
npm run test:e2e       # Playwright E2E (28 tests, Chromium, auto-starts dev server)
```

6b. Architecture table, add after the "Graph layout" row:

```
| Sankey layout | d3-sankey (sources → codes → themes flows) |
```

6c. Key Files tree — add under `components/`:

```
    sankey/
      SankeyView.js             Sankey of Evidence — fixed 16:10 figure, hover path highlight,
                                theme isolation, code click → CodeEditModal, subtheme toggle
```

and under `utils/` after `wallGeometry.js`:

```
    sankeyTransform.js          Pure transform: graph → d3-sankey nodes/links, Unassigned sink,
                                "No source" bucket, single-source grounding warnings. No d3 imports.
```

6d. App-Level UI State table, `view` row:

```
| `view` | `'wall'\|'graph'\|'sankey'` | Active center panel; `'graph'` default. Graph-only toolbar actions disable off-view via `graphOnly` prop on `TbBtn`. Sankey is read-mostly: code click opens CodeEditModal; export id lives on its figure frame |
```

Also update the "Export ID" bullet under Critical Conventions to mention SankeyView:

```
- **Export ID:** the mounted view's export root has `id="canvas-export-target"` (Canvas root, WallView root, or SankeyView's fixed-ratio figure frame — only one renders at a time). `exportUtils.js` and `App.js` both depend on this — do not rename.
```

- [ ] **Step 7: Commit**

```powershell
git add e2e/app.spec.js CLAUDE.md
git commit -m "test: sankey render smoke e2e; docs: CLAUDE.md phase-2 updates"
```

---

## Execution notes (environment)

- **Fresh worktree bootstrap** is Task 1 — do not skip `npm install --no-save @playwright/test@1.59.1`; it is deliberately absent from package.json.
- **E2E needs port 3000 free.** Playwright auto-starts the dev server via `playwright.config.js`. Stop any running preview server on 3000 first.
- **Preview servers:** if you use `preview_start`, add a launch.json config using `npm start --prefix <this-worktree-path>` with a unique `PORT` — the default `thematic-app` config serves whatever directory it was configured for, which may be a stale checkout.
- **PowerShell** is the primary shell: `$env:CI="true"; npx react-scripts test --watchAll=false` (not `CI=true npm test`).

## Out of scope (YAGNI, per design §5)

Multi-quote ribbon weighting (each code counts 1 for now — the transform's `value` field is where weighting would land later), Metro-map lens, report view (Phase 3), collaboration/snapshots, retiring the Graph view.



