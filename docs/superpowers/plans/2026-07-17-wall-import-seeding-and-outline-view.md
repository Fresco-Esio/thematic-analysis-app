# Wall Import Seeding + Outline View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the import→Wall bug (no regions created, so moving any imported card unassigns it) and replace the Sankey view with an "Outline" hierarchy view (themes → subthemes → code chips) plus a theme × source grounding matrix.

**Architecture:** Part 1 adds a pure `seedWallLayout()` helper to `wallGeometry.js`, wired into `ImportModal.handleConfirm()`, plus a mount-time self-heal in `WallView`. Part 2 adds a pure `outlineTransform.js` + div-based `OutlineView` component, replacing `SankeyView`/`sankeyTransform`/`d3-sankey` entirely.

**Tech Stack:** React 19 (functional components), Tailwind + inline styles (Neo-Brutalist conventions), Jest + @testing-library, Playwright E2E. No d3 needed for either part.

**Spec:** `docs/superpowers/specs/2026-07-17-wall-import-seeding-and-outline-view-design.md`

**⚠ Jest in this worktree:** CRA's jest finds 0 tests under `.claude/worktrees/…` (dot-directory). Always run unit tests as:

```bash
npm test -- --watchAll=false --testMatch "**/.claude/**/src/**/*.{spec,test}.{js,jsx,ts,tsx}"
```

Expected baseline before starting: 89 tests, 7 suites, all green.

---

### Task 1: `seedWallLayout()` in wallGeometry.js

**Goal:** Pure helper that produces non-overlapping regions sized to code count, and grid `wallPosition`s fully inside each region.

**Files:**
- Modify: `src/utils/wallGeometry.js` (append)
- Test: `src/utils/wallGeometry.test.js` (append `describe` block)

**Acceptance Criteria:**
- [ ] Every seeded card is `containment(cardRect(pos), region.rect).fully === true`
- [ ] No two seeded regions overlap
- [ ] Regions respect 440×320 minimum; themes with existing regions get no new region but their codes still get positions inside the existing rect (clamped)
- [ ] Codes with no theme entry receive no wallPosition
- [ ] New regions are placed below existing regions (re-import case)

**Verify:** `npm test -- --watchAll=false --testMatch "**/.claude/**/src/**/*.{spec,test}.{js,jsx,ts,tsx}"` → all pass, new `seedWallLayout` tests green

**Steps:**

- [ ] **Step 1: Write the failing tests**

Append to `src/utils/wallGeometry.test.js`:

```js
import { seedWallLayout } from './wallGeometry'; // add to existing import line instead if one exists

describe('seedWallLayout', () => {
  const theme = (id) => ({ id, type: 'theme', label: id });
  const code = (id) => ({ id, type: 'code', label: id });
  const codesFor = (themeId, n) =>
    Array.from({ length: n }, (_, i) => code(`${themeId}-c${i}`));

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  test('one region per theme, min size respected, id convention', () => {
    const t = theme('t1');
    const byTheme = new Map([['t1', codesFor('t1', 1)]]);
    const { regions } = seedWallLayout([t], byTheme);
    expect(regions).toHaveLength(1);
    expect(regions[0].id).toBe('region-t1');
    expect(regions[0].themeId).toBe('t1');
    expect(regions[0].rect.w).toBeGreaterThanOrEqual(440);
    expect(regions[0].rect.h).toBeGreaterThanOrEqual(320);
  });

  test('every card lands fully inside its theme region', () => {
    const themes = [theme('t1'), theme('t2')];
    const byTheme = new Map([['t1', codesFor('t1', 7)], ['t2', codesFor('t2', 23)]]);
    const { regions, wallPositions } = seedWallLayout(themes, byTheme);
    for (const t of themes) {
      const region = regions.find(r => r.themeId === t.id);
      for (const c of byTheme.get(t.id)) {
        const pos = wallPositions.get(c.id);
        expect(pos).toBeDefined();
        expect(containment(cardRect(pos), region.rect).fully).toBe(true);
      }
    }
  });

  test('regions never overlap each other, even with many large themes', () => {
    const themes = Array.from({ length: 9 }, (_, i) => theme(`t${i}`));
    const byTheme = new Map(themes.map((t, i) => [t.id, codesFor(t.id, 3 + i * 4)]));
    const { regions } = seedWallLayout(themes, byTheme);
    expect(regions).toHaveLength(9);
    for (let i = 0; i < regions.length; i++) {
      for (let j = i + 1; j < regions.length; j++) {
        expect(overlaps(regions[i].rect, regions[j].rect)).toBe(false);
      }
    }
  });

  test('theme with an existing region gets no new region; codes grid into the existing rect', () => {
    const existing = { id: 'region-t1', themeId: 't1', rect: { x: 500, y: 500, w: 440, h: 320 } };
    const byTheme = new Map([['t1', codesFor('t1', 4)]]);
    const { regions, wallPositions } = seedWallLayout([theme('t1')], byTheme, [existing]);
    expect(regions).toHaveLength(0);
    for (const c of byTheme.get('t1')) {
      expect(containment(cardRect(wallPositions.get(c.id)), existing.rect).fully).toBe(true);
    }
  });

  test('overflowing an existing small region clamps cards inside (piles handle stacking)', () => {
    const existing = { id: 'region-t1', themeId: 't1', rect: { x: 0, y: 0, w: 440, h: 320 } };
    const byTheme = new Map([['t1', codesFor('t1', 30)]]);
    const { wallPositions } = seedWallLayout([theme('t1')], byTheme, [existing]);
    for (const c of byTheme.get('t1')) {
      expect(containment(cardRect(wallPositions.get(c.id)), existing.rect).fully).toBe(true);
    }
  });

  test('new regions start below existing regions', () => {
    const existing = { id: 'region-old', themeId: 'old', rect: { x: 80, y: 80, w: 600, h: 400 } };
    const { regions } = seedWallLayout([theme('t1')], new Map([['t1', codesFor('t1', 2)]]), [existing]);
    expect(regions[0].rect.y).toBeGreaterThanOrEqual(480); // below 80 + 400
  });

  test('themes with zero codes still get a (minimum-size) region; no positions emitted', () => {
    const { regions, wallPositions } = seedWallLayout([theme('t1')], new Map());
    expect(regions).toHaveLength(1);
    expect(wallPositions.size).toBe(0);
  });
});
```

Note: `containment` and `cardRect` are already imported at the top of the test file — extend the existing import statement rather than duplicating it.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --watchAll=false --testMatch "**/.claude/**/src/**/*.{spec,test}.{js,jsx,ts,tsx}"`
Expected: FAIL — `seedWallLayout is not a function` (or not exported)

- [ ] **Step 3: Implement `seedWallLayout`**

Append to `src/utils/wallGeometry.js`:

```js
// ── Import seeding ───────────────────────────────────────────────────────────

const CARD_W = 176, CARD_H = 96;          // must match cardRect() defaults
const CELL_W = 192, CELL_H = 112;         // card + gutter
const REGION_PAD = 24;                    // inner padding on all sides
const LABEL_HEADROOM = 48;                // clearance under the region label plate
const REGION_GUTTER = 80;                 // spacing between packed regions
const ROW_WRAP_W = 2400;                  // wrap region-packing rows at this width
const MIN_REGION_W = 440, MIN_REGION_H = 320; // matches Add Theme / v1 migration

/**
 * Seed Wall territories for imported themes: one non-overlapping region per
 * theme that lacks one (sized to its card count, packed into rows below any
 * existing regions), plus grid wallPositions for every themed code — always
 * FULLY inside its region so assignmentAfterDrop keeps the assignment.
 * Themes that already have a region keep it; their new codes grid into the
 * existing rect, clamped inside (overflow stacks — clusterPiles handles it).
 *
 * @param {Array}  themes          theme nodes to place codes for
 * @param {Map}    codesByThemeId  themeId → code nodes (import order)
 * @param {Array}  existingRegions current state.regions
 * @returns {{ regions: Array, wallPositions: Map<codeId, {x,y}> }}
 */
export function seedWallLayout(themes, codesByThemeId, existingRegions = []) {
  const regionByTheme = new Map(existingRegions.map(r => [r.themeId, r]));
  const newRegions = [];
  const wallPositions = new Map();

  // New regions pack below whatever is already on the wall
  const originX = 80;
  const originY = existingRegions.length
    ? Math.max(...existingRegions.map(r => r.rect.y + r.rect.h)) + REGION_GUTTER
    : 80;

  // 1. Size + row-pack a region per theme lacking one
  let cx = originX, cy = originY, rowH = 0;
  for (const t of themes) {
    if (regionByTheme.has(t.id)) continue;
    const n = (codesByThemeId.get(t.id) || []).length;
    const cols = Math.max(2, Math.ceil(Math.sqrt(n * 1.5)));
    const rows = Math.max(1, Math.ceil(n / cols));
    const w = Math.max(MIN_REGION_W, cols * CELL_W + REGION_PAD * 2);
    const h = Math.max(MIN_REGION_H, rows * CELL_H + REGION_PAD * 2 + LABEL_HEADROOM);
    if (cx > originX && cx + w > ROW_WRAP_W) {
      cx = originX;
      cy += rowH + REGION_GUTTER;
      rowH = 0;
    }
    const region = { id: `region-${t.id}`, themeId: t.id, rect: { x: cx, y: cy, w, h } };
    newRegions.push(region);
    regionByTheme.set(t.id, region);
    cx += w + REGION_GUTTER;
    rowH = Math.max(rowH, h);
  }

  // 2. Grid card centers inside each theme's region (new or existing)
  for (const t of themes) {
    const codes = codesByThemeId.get(t.id) || [];
    const region = regionByTheme.get(t.id);
    if (!codes.length || !region) continue;
    const { rect } = region;
    const firstX = rect.x + REGION_PAD + CARD_W / 2;
    const firstY = rect.y + LABEL_HEADROOM + REGION_PAD + CARD_H / 2;
    const maxX = rect.x + rect.w - REGION_PAD - CARD_W / 2;
    const maxY = rect.y + rect.h - REGION_PAD - CARD_H / 2;
    const fitCols = Math.max(1, Math.floor((rect.w - REGION_PAD * 2) / CELL_W));
    codes.forEach((c, i) => {
      const col = i % fitCols;
      const row = Math.floor(i / fitCols);
      wallPositions.set(c.id, {
        x: Math.min(firstX + col * CELL_W, maxX),
        y: Math.min(firstY + row * CELL_H, maxY),
      });
    });
  }

  return { regions: newRegions, wallPositions };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --watchAll=false --testMatch "**/.claude/**/src/**/*.{spec,test}.{js,jsx,ts,tsx}"`
Expected: PASS — all suites green, including 7 new tests

- [ ] **Step 5: Commit**

```bash
git add src/utils/wallGeometry.js src/utils/wallGeometry.test.js
git commit -m "feat: add seedWallLayout — sized, packed regions + in-region card grids"
```

---

### Task 2: Wire seeding into ImportModal

**Goal:** Import dispatches regions and patched `wallPosition`s so the Wall opens sorted and drops behave correctly.

**Files:**
- Modify: `src/components/modals/ImportModal.js` (imports, `useGraph` destructure, `handleConfirm`)

**Acceptance Criteria:**
- [ ] `handleConfirm` dispatches `ADD_REGION` for each new theme region after `ADD_NODES`
- [ ] Assigned code nodes carry seeded `wallPosition`; unthemed codes carry none (→ tray)
- [ ] New theme nodes get `wallPosition` at their region center
- [ ] `clearFirst` ignores pre-existing regions; append-mode reuses them
- [ ] Existing unit suite still green

**Verify:** `npm test -- --watchAll=false --testMatch "**/.claude/**/src/**/*.{spec,test}.{js,jsx,ts,tsx}"` → all pass (behavioral E2E lands in Task 3)

**Steps:**

- [ ] **Step 1: Update imports and context destructure**

In `src/components/modals/ImportModal.js`:

```js
import { seedWallLayout } from '../../utils/wallGeometry';
```

and change line 25 from `const { nodes }  = useGraph();` to:

```js
const { nodes, regions } = useGraph();
```

- [ ] **Step 2: Replace `handleConfirm`**

Replace the existing `handleConfirm` body with:

```js
  function handleConfirm() {
    if (!result) return;

    if (clearFirst) dispatch({ type: 'CLEAR' });

    // Seed Wall territories: one region per new theme, cards gridded inside
    // (spec: docs/superpowers/specs/2026-07-17-…-design.md Part 1).
    const codesByThemeId = new Map();
    result.codeNodes.forEach(c => {
      if (!c.primaryThemeId) return;
      if (!codesByThemeId.has(c.primaryThemeId)) codesByThemeId.set(c.primaryThemeId, []);
      codesByThemeId.get(c.primaryThemeId).push(c);
    });
    const priorRegions = clearFirst ? [] : (regions || []);
    // Existing themes reused by this import also collect their new codes —
    // the seeder grids those into the theme's existing rect.
    const themesForSeed = [
      ...result.themeNodes,
      ...(clearFirst ? [] : nodes.filter(n => n.type === 'theme' && codesByThemeId.has(n.id))),
    ];
    const seeded = seedWallLayout(themesForSeed, codesByThemeId, priorRegions);

    const regionCenter = new Map(seeded.regions.map(r => [
      r.themeId,
      { x: r.rect.x + r.rect.w / 2, y: r.rect.y + r.rect.h / 2 },
    ]));
    const themeNodes = result.themeNodes.map(t =>
      regionCenter.has(t.id) ? { ...t, wallPosition: regionCenter.get(t.id) } : t
    );
    const codeNodes = result.codeNodes.map(c =>
      seeded.wallPositions.has(c.id) ? { ...c, wallPosition: seeded.wallPositions.get(c.id) } : c
    );

    // Add theme nodes first (so code nodes can reference them)
    if (themeNodes.length > 0) {
      dispatch({ type: 'ADD_NODES', nodes: themeNodes });
    }
    if (codeNodes.length > 0) {
      dispatch({ type: 'ADD_NODES', nodes: codeNodes });
    }
    result.edges.forEach(edge => {
      dispatch({ type: 'ADD_EDGE', edge });
    });
    seeded.regions.forEach(region => {
      dispatch({ type: 'ADD_REGION', region });
    });

    handleClose();
  }
```

- [ ] **Step 3: Run unit tests + build**

Run: `npm test -- --watchAll=false --testMatch "**/.claude/**/src/**/*.{spec,test}.{js,jsx,ts,tsx}"`
Expected: PASS (no suite covers ImportModal directly; this catches regressions via importUtils/GraphContext suites)

Run: `npm run build`
Expected: compiles clean (catches import typos)

- [ ] **Step 4: Commit**

```bash
git add src/components/modals/ImportModal.js
git commit -m "fix: import seeds Wall regions and card positions (codes no longer unassign on first move)"
```

---

### Task 3: WallView self-heal + E2E coverage for the fixed import

**Goal:** Saved states that hit the bug get regions back on Wall mount; E2E proves the import→Wall→drag flow keeps assignments.

**Files:**
- Modify: `src/components/wall/WallView.js` (one mount effect + import)
- Modify: `e2e/app.spec.js` (new test after the existing Wall tests)

**Acceptance Criteria:**
- [ ] A stored state with assigned codes but no regions grows one 440×320 region per affected theme on Wall mount (idempotent — `ADD_REGION` no-ops on dup ids)
- [ ] E2E: after CSV import, the Wall shows one region per theme and a short in-region drag does NOT unassign the card

**Verify:** `npx playwright test --reporter=list` → all E2E green including the new test

**Steps:**

- [ ] **Step 1: Add the self-heal effect to WallView**

In `src/components/wall/WallView.js`, the component already has `nodes`, `regions`, `dispatch` in scope. Add after the pan/zoom `useEffect`:

```js
  // ── Self-heal: pre-fix saved states have assigned codes but no regions
  // (import never seeded them). Give each such theme a default territory,
  // centered on the theme's position. Mount-only: re-running after an Undo
  // would fight the user's undo of these very ADD_REGIONs.
  useEffect(() => {
    const assignedThemeIds = new Set(
      nodes.filter(n => n.type === 'code' && n.primaryThemeId).map(n => n.primaryThemeId)
    );
    const regionThemeIds = new Set((regions || []).map(r => r.themeId));
    nodes
      .filter(n => n.type === 'theme' && assignedThemeIds.has(n.id) && !regionThemeIds.has(n.id))
      .forEach(t => {
        const c = t.wallPosition ?? { x: t.x ?? 400, y: t.y ?? 300 };
        dispatch({ type: 'ADD_REGION', region: {
          id: `region-${t.id}`, themeId: t.id,
          rect: { x: c.x - 220, y: c.y - 160, w: 440, h: 320 },
        }});
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 2: Add the E2E test**

In `e2e/app.spec.js`, after the last existing Wall test, add:

```js
// ── Wall import seeding — regions exist and drags keep assignment ───────────

test('Wall shows a region per imported theme; in-region drag keeps assignment', async ({ page }) => {
  // Import the sample CSV (same flow as test 9)
  await page.getByRole('button', { name: /Import/i }).click();
  const csvPath = path.resolve(__dirname, '..', 'docs', 'samples', 'thematic-import-sample.csv');
  await page.locator('input[type="file"]').setInputFiles(csvPath);
  await expect(page.getByText('Preview Import')).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: /Confirm Import/i }).click();
  await expect(page.getByText('Preview Import')).not.toBeVisible({ timeout: 3000 });

  await page.getByRole('button', { name: /Wall/ }).click();

  // Sample CSV has 9 themes → 9 seeded regions
  await expect(page.locator('[aria-label*="theme region"]')).toHaveCount(9);

  // Only the 1 unthemed code waits in the tray — the 9 assigned cards are placed
  const tray = page.locator('[data-testid="wall-tray"]');
  await expect(tray.locator('[aria-label*="code card"]')).toHaveCount(1);

  // Nudge an assigned card a few px (well inside its region) and drop it
  const card = page.locator('[data-testid="wall-surface"] [aria-label*="Compulsive checking"]').first();
  const box = await card.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 2 + 10, { steps: 4 });
  await page.mouse.up();

  // Regression guard: pre-fix, ANY drop unassigned the card (regions were []).
  // Card must not land in the tray and the unassigned count must not grow.
  await expect(tray.locator('[aria-label*="Compulsive checking"]')).toHaveCount(0);
  await expect(page.getByText('1 unassigned')).toBeVisible();
});
```

- [ ] **Step 3: Run E2E**

Run: `npx playwright test --reporter=list`
Expected: all tests pass, including the new one. (If the drag proves flaky, increase `steps` — do not weaken the tray/unassigned assertions.)

- [ ] **Step 4: Commit**

```bash
git add src/components/wall/WallView.js e2e/app.spec.js
git commit -m "fix: self-heal missing Wall regions on mount; e2e for import seeding"
```

---

### Task 4: `outlineTransform.js` (pure) with tests

**Goal:** Pure transform graph → outline structure (themes → subthemes → codes, sources, grounding warnings). No React/d3.

**Files:**
- Create: `src/utils/outlineTransform.js`
- Test: `src/utils/outlineTransform.test.js`

**Acceptance Criteria:**
- [ ] Themes sorted by codeCount desc; codes keep input order; empty themes retained
- [ ] Subtheme routing: first edge from a code to a subtheme of the code's own theme
- [ ] Blank/whitespace source buckets to "No source", listed last in `sources`
- [ ] `warnings` only when ≥2 distinct sources exist overall; flags themes drawing on exactly 1
- [ ] Dangling `primaryThemeId` (deleted theme) counts as unassigned
- [ ] `isEmpty` true only when there are no codes

**Verify:** `npm test -- --watchAll=false --testMatch "**/.claude/**/src/**/*.{spec,test}.{js,jsx,ts,tsx}"` → new suite green

**Steps:**

- [ ] **Step 1: Write the failing tests**

Create `src/utils/outlineTransform.test.js`:

```js
/**
 * outlineTransform.test.js
 * Pure transform: graph state → Outline view structure.
 */
import { buildOutline, NO_SOURCE_LABEL } from './outlineTransform';

const theme = (id, label, extra = {}) => ({ id, type: 'theme', label, color: '#4f46e5', ...extra });
const sub = (id, label, primaryThemeId) => ({ id, type: 'subtheme', label, primaryThemeId, color: '#4f46e5' });
const code = (id, label, extra = {}) => ({ id, type: 'code', label, quote: '', source: '', primaryThemeId: null, ...extra });

describe('buildOutline', () => {
  test('no codes → isEmpty', () => {
    const out = buildOutline([theme('t1', 'Coping')], []);
    expect(out.isEmpty).toBe(true);
    expect(out.themes).toEqual([]);
  });

  test('groups codes under their theme; themes sorted by codeCount desc; empty themes kept last', () => {
    const out = buildOutline([
      theme('t1', 'Small'), theme('t2', 'Big'), theme('t3', 'Empty'),
      code('c1', 'A', { primaryThemeId: 't1' }),
      code('c2', 'B', { primaryThemeId: 't2' }),
      code('c3', 'C', { primaryThemeId: 't2' }),
    ], []);
    expect(out.themes.map(t => t.theme.id)).toEqual(['t2', 't1', 't3']);
    expect(out.themes[0].codeCount).toBe(2);
    expect(out.themes[2].codeCount).toBe(0);
    expect(out.themes[0].looseCodes.map(c => c.id)).toEqual(['c2', 'c3']);
  });

  test('routes a code through its subtheme (first matching edge, own theme only)', () => {
    const out = buildOutline([
      theme('t1', 'T'), sub('s1', 'S', 't1'), sub('sx', 'Other', 't2'),
      code('c1', 'A', { primaryThemeId: 't1' }),
      code('c2', 'B', { primaryThemeId: 't1' }),
    ], [
      { id: 'e1', source: 'c1', target: 'sx' }, // wrong theme's subtheme → ignored
      { id: 'e2', source: 'c1', target: 's1' },
    ]);
    const t = out.themes[0];
    expect(t.subthemes).toHaveLength(1);
    expect(t.subthemes[0].subtheme.id).toBe('s1');
    expect(t.subthemes[0].codes.map(c => c.id)).toEqual(['c1']);
    expect(t.looseCodes.map(c => c.id)).toEqual(['c2']);
  });

  test('blank source buckets to "No source", listed last; others alphabetical', () => {
    const out = buildOutline([
      code('c1', 'A', { source: 'Zeta' }),
      code('c2', 'B', { source: '  ' }),
      code('c3', 'C', { source: 'Alpha' }),
    ], []);
    expect(out.sources).toEqual(['Alpha', 'Zeta', NO_SOURCE_LABEL]);
  });

  test('warnings flag single-source themes ONLY when ≥2 sources exist overall', () => {
    const one = buildOutline([
      theme('t1', 'T'),
      code('c1', 'A', { source: 'I1', primaryThemeId: 't1' }),
    ], []);
    expect(one.warnings.size).toBe(0); // single source overall → no warnings

    const two = buildOutline([
      theme('t1', 'T'), theme('t2', 'U'),
      code('c1', 'A', { source: 'I1', primaryThemeId: 't1' }),
      code('c2', 'B', { source: 'I1', primaryThemeId: 't2' }),
      code('c3', 'C', { source: 'I2', primaryThemeId: 't2' }),
    ], []);
    expect(two.warnings.has('t1')).toBe(true);  // only I1
    expect(two.warnings.has('t2')).toBe(false); // I1 + I2
  });

  test('unassigned: no primaryThemeId or dangling reference', () => {
    const out = buildOutline([
      theme('t1', 'T'),
      code('c1', 'A', { primaryThemeId: 't1' }),
      code('c2', 'B'),
      code('c3', 'C', { primaryThemeId: 'ghost' }),
    ], []);
    expect(out.unassigned.map(c => c.id)).toEqual(['c2', 'c3']);
  });

  test('sourceCounts per theme count codes by source bucket', () => {
    const out = buildOutline([
      theme('t1', 'T'),
      code('c1', 'A', { source: 'I1', primaryThemeId: 't1' }),
      code('c2', 'B', { source: 'I1', primaryThemeId: 't1' }),
      code('c3', 'C', { source: 'I2', primaryThemeId: 't1' }),
    ], []);
    expect(out.themes[0].sourceCounts.get('I1')).toBe(2);
    expect(out.themes[0].sourceCounts.get('I2')).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --watchAll=false --testMatch "**/.claude/**/src/**/*.{spec,test}.{js,jsx,ts,tsx}"`
Expected: FAIL — cannot resolve `./outlineTransform`

- [ ] **Step 3: Implement the transform**

Create `src/utils/outlineTransform.js`:

```js
/**
 * outlineTransform.js
 * ──────────────────────────────────────────────────────────────────────────
 * Pure transform: graph state → Outline view structure.
 *
 *   buildOutline(nodes, edges) → {
 *     themes: [{ theme, subthemes: [{ subtheme, codes }], looseCodes,
 *                codeCount, sourceCounts: Map<label, n> }],   // codeCount desc
 *     unassigned: [codes],           // no theme, or dangling primaryThemeId
 *     sources: [label],              // distinct, alphabetical, "No source" last
 *     warnings: Set<themeId>,        // single-source themes (≥2 sources exist)
 *     isEmpty,
 *   }
 *
 * Subtheme routing matches the former Sankey rule: a code renders under the
 * first edge-linked subtheme belonging to the code's own theme.
 *
 * NO React/d3 imports — stays unit-testable under CRA jest.
 */

export const NO_SOURCE_LABEL = 'No source';

export function buildOutline(nodes, edges) {
  const codes = nodes.filter(n => n.type === 'code');
  if (codes.length === 0) {
    return { themes: [], unassigned: [], sources: [], warnings: new Set(), isEmpty: true };
  }

  const themeNodes = nodes.filter(n => n.type === 'theme');
  const themeIds = new Set(themeNodes.map(t => t.id));
  const subthemesById = new Map(nodes.filter(n => n.type === 'subtheme').map(n => [n.id, n]));
  const codesById = new Map(codes.map(n => [n.id, n]));

  // code id → routing subtheme (first edge to a subtheme of the code's own theme)
  const subthemeForCode = new Map();
  for (const e of edges) {
    if (subthemeForCode.has(e.source)) continue;
    const s = subthemesById.get(e.target);
    const c = codesById.get(e.source);
    if (s && c && c.primaryThemeId && s.primaryThemeId === c.primaryThemeId) {
      subthemeForCode.set(e.source, s);
    }
  }

  const sourceOf = (c) => (c.source || '').trim() || NO_SOURCE_LABEL;

  const sourceSet = new Set(codes.map(sourceOf));
  const sources = [...sourceSet]
    .filter(s => s !== NO_SOURCE_LABEL)
    .sort((a, b) => a.localeCompare(b));
  if (sourceSet.has(NO_SOURCE_LABEL)) sources.push(NO_SOURCE_LABEL);

  const themes = themeNodes.map(t => {
    const themeCodes = codes.filter(c => c.primaryThemeId === t.id);
    const subMap = new Map(); // subthemeId → { subtheme, codes }
    const looseCodes = [];
    const sourceCounts = new Map();
    for (const c of themeCodes) {
      const s = sourceOf(c);
      sourceCounts.set(s, (sourceCounts.get(s) || 0) + 1);
      const routed = subthemeForCode.get(c.id);
      if (routed) {
        if (!subMap.has(routed.id)) subMap.set(routed.id, { subtheme: routed, codes: [] });
        subMap.get(routed.id).codes.push(c);
      } else {
        looseCodes.push(c);
      }
    }
    return { theme: t, subthemes: [...subMap.values()], looseCodes, codeCount: themeCodes.length, sourceCounts };
  });
  themes.sort((a, b) => b.codeCount - a.codeCount);

  const unassigned = codes.filter(c => !c.primaryThemeId || !themeIds.has(c.primaryThemeId));

  const warnings = new Set();
  if (sources.length >= 2) {
    for (const t of themes) {
      if (t.codeCount > 0 && t.sourceCounts.size === 1) warnings.add(t.theme.id);
    }
  }

  return { themes, unassigned, sources, warnings, isEmpty: false };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --watchAll=false --testMatch "**/.claude/**/src/**/*.{spec,test}.{js,jsx,ts,tsx}"`
Expected: PASS — all suites green

- [ ] **Step 5: Commit**

```bash
git add src/utils/outlineTransform.js src/utils/outlineTransform.test.js
git commit -m "feat: add outlineTransform — pure themes→subthemes→codes structure with grounding data"
```

---

### Task 5: OutlineView component; replace Sankey everywhere

**Goal:** New div-based Outline view wired into App/Toolbar/HelpOverlay; Sankey files and `d3-sankey` removed.

**Files:**
- Create: `src/components/outline/OutlineView.js`
- Modify: `src/App.js` (import, view union comment, render branch)
- Modify: `src/components/Toolbar.js:103` (tab), `:7` (comment)
- Modify: `src/components/help/HelpOverlay.js` (view guide entry + workflow strip)
- Delete: `src/components/sankey/SankeyView.js`, `src/utils/sankeyTransform.js`, `src/utils/sankeyTransform.test.js`
- Modify: `package.json` (remove `d3-sankey`)

**Acceptance Criteria:**
- [ ] Outline tab renders theme bands (color header, `n codes · m sources`, ⚠ when warned), subtheme sub-bands, code chips in a wrapped grid, gray Unassigned band
- [ ] Hover code → QuoteTooltip; click code → CodeEditModal; click theme header → isolation (Escape / ✕ exits)
- [ ] Grounding matrix renders when ≥2 sources; single-source note otherwise
- [ ] Document root carries `id="canvas-export-target"`; PNG/PDF export works
- [ ] No references to sankey remain in `src/`; build compiles; unit suite green (sankeyTransform.test.js deleted with its module)

**Verify:** `npm run build` clean; `npm test -- --watchAll=false --testMatch "**/.claude/**/src/**/*.{spec,test}.{js,jsx,ts,tsx}"` green; `grep -ri sankey src/` → no hits

**Steps:**

- [ ] **Step 1: Create `src/components/outline/OutlineView.js`**

```jsx
/**
 * OutlineView.js
 * ──────────────────────────────────────────────────────────────────────────
 * Outline — the written-up shape of the analysis, as a scrollable document:
 * theme bands (height = prevalence) → subtheme sub-bands → code chips, then
 * a theme × source grounding matrix (rendered once ≥2 sources exist).
 *
 * Replaces the Sankey: with one source and unique value-1 codes, ribbons
 * carried no signal and 60+ labels collided in a fixed frame. A document
 * with dynamic height cannot collide.
 *
 * The document root carries id="canvas-export-target" (shared export id —
 * Canvas / WallView / OutlineView / ReportView are mutually exclusive mounts).
 *
 * PROPS:
 *   onEditCode {fn(nodeId)} — open CodeEditModal (the only edit affordance)
 *   onImport   {fn}         — open ImportModal from the empty state
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useGraph } from '../../context/GraphContext';
import { buildOutline } from '../../utils/outlineTransform';
import QuoteTooltip from '../QuoteTooltip';

function CodeChip({ code, onClick, onMove, onLeave }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Edit code ${code.label}`}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="px-2.5 py-1.5 text-sm font-semibold border-2 border-[#0f0d0a] bg-white cursor-pointer hover:shadow-[3px_3px_0_#0f0d0a]"
      style={{ borderLeft: `6px solid ${code.color || '#6b7280'}` }}
    >
      {code.label}
    </div>
  );
}

export default function OutlineView({ onEditCode, onImport }) {
  const { nodes, edges } = useGraph();
  const wrapRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);           // { x, y, node } | null
  const [isolatedThemeId, setIsolatedThemeId] = useState(null);

  useEffect(() => {
    if (!isolatedThemeId) return;
    function onKey(e) { if (e.key === 'Escape') setIsolatedThemeId(null); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isolatedThemeId]);

  const data = useMemo(() => buildOutline(nodes, edges), [nodes, edges]);

  function chipHandlers(code) {
    return {
      onClick: () => onEditCode?.(code.id),
      onMove: (e) => {
        const rect = wrapRef.current.getBoundingClientRect();
        setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, node: code });
      },
      onLeave: () => setTooltip(null),
    };
  }

  if (data.isEmpty) {
    return (
      <div className="flex-1 relative flex items-center justify-center overflow-hidden" style={{ backgroundColor: 'var(--bg-canvas)' }}>
        <div className="text-center max-w-md p-8 border-2 border-[#0f0d0a] bg-white shadow-[8px_8px_0_#0f0d0a]">
          <p className="text-xl font-bold mb-3">Nothing to outline yet</p>
          <p className="text-base mb-5" style={{ color: '#6b6560' }}>
            The Outline shows your themes with their subthemes and codes, plus
            how each theme is grounded across sources. Import a CSV/Excel of
            coded excerpts, or add codes and connect them to themes.
          </p>
          <button
            onClick={onImport}
            className="px-4 py-2 font-bold text-base cursor-pointer border-2 bg-[#dc2626] text-white border-[#dc2626] hover:bg-[#b91c1c] shadow-[3px_3px_0_#0f0d0a]"
          >
            ⬆ Import Data
          </button>
        </div>
      </div>
    );
  }

  const maxCell = Math.max(1, ...data.themes.flatMap(t => [...t.sourceCounts.values()]));

  return (
    <div ref={wrapRef} className="flex-1 relative overflow-y-auto" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      <div
        id="canvas-export-target"
        className="mx-auto my-8 bg-white border-2 border-[#0f0d0a] shadow-[8px_8px_0_#0f0d0a] p-8"
        style={{ maxWidth: 1080 }}
      >
        <p className="text-sm font-extrabold tracking-[0.14em] mb-6" style={{ color: '#6b6560' }}>
          THEMATIC OUTLINE
        </p>

        {data.themes.map(({ theme, subthemes, looseCodes, codeCount, sourceCounts }) => {
          const collapsed = isolatedThemeId && isolatedThemeId !== theme.id;
          const warned = data.warnings.has(theme.id);
          return (
            <section key={theme.id} data-testid="outline-theme" className="mb-5" style={{ opacity: collapsed ? 0.45 : 1 }}>
              <div
                role="button"
                tabIndex={0}
                aria-label={`Isolate theme ${theme.label}`}
                onClick={() => setIsolatedThemeId(prev => (prev === theme.id ? null : theme.id))}
                onKeyDown={(e) => { if (e.key === 'Enter') setIsolatedThemeId(prev => (prev === theme.id ? null : theme.id)); }}
                className="flex items-center justify-between px-4 py-2.5 border-2 border-[#0f0d0a] cursor-pointer"
                style={{ backgroundColor: theme.color || '#6b7280', color: '#ffffff' }}
              >
                <span className="font-extrabold text-lg">
                  {warned && (
                    <span title="Grounded in a single source: consider whether this theme rests on one voice">⚠ </span>
                  )}
                  {theme.label}
                </span>
                <span className="text-sm font-bold opacity-90">
                  {codeCount} {codeCount === 1 ? 'code' : 'codes'} · {sourceCounts.size} {sourceCounts.size === 1 ? 'source' : 'sources'}
                </span>
              </div>

              {!collapsed && (
                <div className="border-2 border-t-0 border-[#0f0d0a] p-4 flex flex-col gap-4">
                  {subthemes.map(({ subtheme, codes }) => (
                    <div key={subtheme.id} className="pl-3" style={{ borderLeft: `4px solid ${subtheme.color || theme.color}` }}>
                      <p className="text-sm font-extrabold mb-2" style={{ color: '#0f0d0a' }}>{subtheme.label}</p>
                      <div className="flex flex-wrap gap-2">
                        {codes.map(c => <CodeChip key={c.id} code={c} {...chipHandlers(c)} />)}
                      </div>
                    </div>
                  ))}
                  {looseCodes.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {looseCodes.map(c => <CodeChip key={c.id} code={c} {...chipHandlers(c)} />)}
                    </div>
                  )}
                  {codeCount === 0 && (
                    <p className="text-sm italic" style={{ color: '#6b6560' }}>No codes assigned yet.</p>
                  )}
                </div>
              )}
            </section>
          );
        })}

        {data.unassigned.length > 0 && (
          <section data-testid="outline-unassigned" className="mb-5">
            <div className="px-4 py-2.5 border-2 border-[#0f0d0a] font-extrabold text-lg text-white" style={{ backgroundColor: '#6b7280' }}>
              Unassigned <span className="text-sm font-bold opacity-90">· {data.unassigned.length}</span>
            </div>
            <div className="border-2 border-t-0 border-[#0f0d0a] p-4 flex flex-wrap gap-2">
              {data.unassigned.map(c => <CodeChip key={c.id} code={c} {...chipHandlers(c)} />)}
            </div>
          </section>
        )}

        {/* Grounding matrix — only meaningful across ≥2 sources */}
        {data.sources.length >= 2 ? (
          <section data-testid="grounding-matrix" className="mt-8">
            <p className="text-sm font-extrabold tracking-[0.14em] mb-3" style={{ color: '#6b6560' }}>
              GROUNDING — CODES PER THEME × SOURCE
            </p>
            <div className="overflow-x-auto">
              <table className="border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="text-left pr-4 pb-2 font-extrabold" />
                    {data.sources.map(s => (
                      <th key={s} className="px-2 pb-2 font-bold text-left max-w-[120px] truncate" title={s}>{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.themes.map(({ theme, sourceCounts }) => (
                    <tr key={theme.id}>
                      <td className="pr-4 py-1 font-extrabold whitespace-nowrap">
                        <span className="inline-block w-3 h-3 mr-2 border border-[#0f0d0a] align-middle" style={{ backgroundColor: theme.color || '#6b7280' }} />
                        {theme.label}
                      </td>
                      {data.sources.map(s => {
                        const n = sourceCounts.get(s) || 0;
                        return (
                          <td
                            key={s}
                            className="px-2 py-1 text-center border border-[#0f0d0a] font-bold min-w-[44px]"
                            style={n > 0 ? {
                              backgroundColor: theme.color || '#6b7280',
                              color: '#ffffff',
                              opacity: 0.35 + 0.65 * (n / maxCell),
                            } : { color: '#d6d0c8' }}
                          >
                            {n > 0 ? n : ''}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <p data-testid="grounding-note" className="mt-8 text-sm italic" style={{ color: '#6b6560' }}>
            Grounding matrix appears when codes come from two or more sources.
          </p>
        )}
      </div>

      {isolatedThemeId && (
        <button
          onClick={() => setIsolatedThemeId(null)}
          className="fixed bottom-16 left-1/2 -translate-x-1/2 px-4 py-2 font-bold text-base border-2 border-[#0f0d0a] bg-[#0f0d0a] text-white cursor-pointer"
        >
          ✕ Show All Themes
        </button>
      )}

      <QuoteTooltip
        visible={!!tooltip}
        x={tooltip?.x ?? 0}
        y={tooltip?.y ?? 0}
        code={tooltip?.node?.label ?? ''}
        quote={tooltip?.node?.quote ?? ''}
        source={tooltip?.node?.source ?? ''}
        color={tooltip?.node?.color ?? '#0f0d0a'}
      />
    </div>
  );
}
```

- [ ] **Step 2: Rewire App.js**

- Replace the import `import SankeyView   from './components/sankey/SankeyView';` with `import OutlineView  from './components/outline/OutlineView';`
- Line 67 comment: `// 'wall' | 'graph' | 'outline' | 'report'`
- Replace the render branch:

```jsx
        ) : view === 'outline' ? (
          <OutlineView
            onEditCode={setCodeEditId}
            onImport={() => setImportOpen(true)}
          />
        ) : (
```

- [ ] **Step 3: Rewire Toolbar.js**

Line 103: replace `['sankey', '⇶ Sankey']` with `['outline', '≣ Outline']`.
Line 7 comment: `{'wall'|'graph'|'outline'|'report'}`.

- [ ] **Step 4: Rewire HelpOverlay.js**

Replace the `sankey:` entry in `viewGuides` with:

```js
    outline: {
      icon: '≣',
      name: 'Outline',
      bullets: [
        'Themes as color bands (biggest first) with subthemes and code chips inside',
        'Click a theme band to isolate it; click a code chip to edit it; hover for its quote',
        '⚠ marks themes grounded in a single source; the matrix below shows codes per theme × source',
      ],
    },
```

Workflow strip (line 104): replace `⇶ Sankey (check your evidence)` with `≣ Outline (check your evidence)`.
Comment on line 8: update view list to `'wall', 'graph', 'outline', 'report'`.

- [ ] **Step 5: Delete Sankey files and dependency**

```bash
git rm src/components/sankey/SankeyView.js src/utils/sankeyTransform.js src/utils/sankeyTransform.test.js
npm uninstall d3-sankey
```

- [ ] **Step 6: Verify no stragglers, build, test**

Run: `grep -ri sankey src/ package.json` → no matches
Run: `npm run build` → compiles clean
Run: `npm test -- --watchAll=false --testMatch "**/.claude/**/src/**/*.{spec,test}.{js,jsx,ts,tsx}"` → all green (sankeyTransform suite gone, outlineTransform suite present)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: replace Sankey with Outline view (theme hierarchy + grounding matrix)"
```

---

### Task 6: E2E rewrite for Outline + CLAUDE.md update

**Goal:** Tests 26–28 target the Outline view; project docs reflect the new architecture.

**Files:**
- Modify: `e2e/app.spec.js:602-668` (tests 26–28)
- Modify: `CLAUDE.md` (Key Files, view union, export-id convention, HelpOverlay flow row)

**Acceptance Criteria:**
- [ ] Full Playwright suite green
- [ ] CLAUDE.md no longer references Sankey; documents Outline view + `seedWallLayout` import seeding

**Verify:** `npx playwright test --reporter=list` → all pass

**Steps:**

- [ ] **Step 1: Replace tests 26–28**

Replace the three Sankey tests in `e2e/app.spec.js` with:

```js
// ── 26. Outline view — switcher + empty state ───────────────────────────────

test('26 — Outline view shows empty-state guidance when no codes exist', async ({ page }) => {
  await page.getByRole('button', { name: /Outline/ }).click();
  await expect(page.getByRole('button', { name: /Outline/ })).toHaveAttribute('aria-pressed', 'true');

  await expect(page.getByText('Nothing to outline yet')).toBeVisible();
  await expect(page.getByRole('button', { name: /Connect/ })).toBeDisabled();
  await page.getByRole('button', { name: /Import Data/ }).click();
  await expect(page.getByText('Import Data', { exact: true })).toBeVisible(); // ImportModal title
});

// ── 27. Outline render smoke after import ───────────────────────────────────

test('27 — Outline renders theme bands, chips, and grounding matrix after CSV import', async ({ page }) => {
  // Import the sample CSV (same flow as test 9)
  await page.getByRole('button', { name: /Import/i }).click();
  const csvPath = path.resolve(__dirname, '..', 'docs', 'samples', 'thematic-import-sample.csv');
  await page.locator('input[type="file"]').setInputFiles(csvPath);
  await expect(page.getByText('Preview Import')).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: /Confirm Import/i }).click();
  await expect(page.getByText('Preview Import')).not.toBeVisible({ timeout: 3000 });

  await page.getByRole('button', { name: /Outline/ }).click();

  const figure = page.locator('#canvas-export-target');
  // Sample: 9 themes, 10 codes (1 unassigned), 5 sources
  await expect(figure.locator('[data-testid="outline-theme"]')).toHaveCount(9);
  await expect(figure.locator('[data-testid="outline-unassigned"]')).toBeVisible();
  await expect(figure.getByRole('button', { name: /Edit code/ })).toHaveCount(10);

  // 5 sources ≥ 2 → matrix renders; every sample theme is single-source → ⚠
  await expect(figure.locator('[data-testid="grounding-matrix"]')).toBeVisible();
  await expect(figure.getByText(/⚠/).first()).toBeVisible();
});

// ── 28. Outline interactions ────────────────────────────────────────────────

test('28 — Outline code chip opens edit modal; theme band isolates', async ({ page }) => {
  // Seed: theme + code, connected (same flow as test 4)
  await page.getByRole('button', { name: /Add Theme/i }).click();
  await page.getByRole('button', { name: /Add Code/i }).click();
  await page.getByRole('button', { name: /Connect/i }).click();
  const codeNode  = page.locator('.nodes-layer > div').filter({ hasNotText: /✓/ }).first();
  const themeNode = page.locator('[role="button"][aria-label*="theme"]').first();
  await codeNode.click({ force: true });
  await themeNode.click({ force: true });
  await page.getByRole('button', { name: /Cancel Connect/i }).click();

  await page.getByRole('button', { name: /Outline/ }).click();

  // Theme isolation toggles on and off via the pill
  await page.getByRole('button', { name: /Isolate theme/ }).click();
  await expect(page.getByRole('button', { name: /Show All Themes/ })).toBeVisible();
  await page.getByRole('button', { name: /Show All Themes/ }).click();
  await expect(page.getByRole('button', { name: /Show All Themes/ })).not.toBeVisible();

  // Code chip opens the edit modal
  await page.getByRole('button', { name: /Edit code/ }).click();
  await expect(page.getByText('Edit Code Node')).toBeVisible();
});
```

- [ ] **Step 2: Run the full E2E suite**

Run: `npx playwright test --reporter=list`
Expected: all pass. If the single-source note test (26) or matrix count differs, fix the assertion against actual sample-CSV contents (9 themes / 10 codes / 5 sources) — not by loosening selectors.

- [ ] **Step 3: Update CLAUDE.md**

- Key Files: remove `sankey/SankeyView.js` + `sankeyTransform.js` rows; add:
  - `components/outline/OutlineView.js` — "Outline view — theme bands → subthemes → code chips, theme isolation, grounding matrix (≥2 sources); document root carries the export id"
  - `utils/outlineTransform.js` — "Pure transform: graph → outline structure, source buckets, single-source warnings. No d3."
  - Extend the `wallGeometry.js` row with `seedWallLayout` (import region seeding).
- Architecture table: remove the "Sankey layout | d3-sankey" row.
- App-Level UI State `view` row: `'wall'|'graph'|'outline'|'report'`; replace the Sankey sentence with "Outline is read-mostly: code chip click opens CodeEditModal; export id lives on its document root."
- Critical Conventions "Export ID" bullet: swap "SankeyView's fixed-ratio figure frame" for "OutlineView's document root".
- Import Pipeline section: add "Import seeds one Wall region per new theme (`seedWallLayout`) and grids assigned codes inside it; WallView self-heals missing regions for pre-fix saves on mount."
- Bug History: append row 15: "Import created no Wall regions — first drag of any imported card unassigned it | Import now seeds regions + wallPositions via `seedWallLayout()`; WallView self-heals on mount".

- [ ] **Step 4: Commit**

```bash
git add e2e/app.spec.js CLAUDE.md
git commit -m "test: point e2e 26-28 at Outline view; document new architecture in CLAUDE.md"
```

---

## Self-Review Notes

- **Spec coverage:** Part 1 → Tasks 1–3 (helper, wiring, self-heal + E2E). Part 2 → Tasks 4–6 (transform, view + deletion, E2E + docs). Both non-goals respected (no assignmentAfterDrop changes, no undo batching).
- **Type consistency:** `seedWallLayout(themes, codesByThemeId, existingRegions)` used identically in Tasks 1–3; `buildOutline(nodes, edges)` and its return shape used identically in Tasks 4–5; testids `outline-theme` / `outline-unassigned` / `grounding-matrix` / `grounding-note` consistent between Tasks 5–6.
- **Known judgment calls:** self-heal is mount-only (avoids fighting Undo); grounding matrix hidden below 2 sources (note shown instead); themes render even with 0 codes.
