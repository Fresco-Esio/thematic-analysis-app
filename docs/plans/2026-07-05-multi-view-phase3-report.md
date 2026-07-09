# Multi-View Phase 3: Living Report — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the fourth view — a "Living Report" that turns the thematic map into written findings (Braun & Clarke phase 6): per-theme chapters with editable prose blocks and pull quotes, a full-screen present mode with a wall mini-map, and text-selectable PDF export via a print stylesheet.

**Architecture:** `report` becomes a fourth top-level key in `GraphContext` state (`{ sections: [{ themeId, proseBlocks, pullQuoteIds }] }`), persisted in the existing v2 localStorage key — sections reference node ids so theme renames flow through and deleted nodes degrade to tombstones. Pure helpers (`reportUtils.js`) derive the effective chapter list (auto-seeding themes, attaching tombstone info) and parse the bold/italic-only inline markup; components stay thin. Present mode is a fixed overlay with its own scroll container and a small static SVG mini-map of the Wall regions.

**Tech Stack:** React 19 (CRA), Framer Motion 12 (existing `motionConfig`), plain CSS `@media print` for export. **No new dependencies.**

**User decisions (already made):**
- Phase 3 per approved design doc §4; Phases 1–2 merged and pushed to origin/master.
- Report data: ordered sections `{themeId, proseBlocks[], pullQuoteIds[]}` in v2 storage; renames flow through (id references); deleted codes degrade to tombstone notes; report tolerates dangling references.
- Edit mode: plain prose blocks, **bold**/*italic* only — no rich-text engine. Quotes come from a per-chapter tray into margin slots (drag; a click affordance is added for accessibility/testability).
- Present mode: full-screen scroll, fixed mini-map (small static wall render) highlighting the current theme's region; pull-quotes animate via existing `motionConfig`.
- Export: print stylesheet → browser PDF (text-selectable); html2canvas only for whole-view PNG.
- Typography: Bricolage, 17px/1.6, 68ch measure. Existing design tokens; existing tests stay green.
- **Delegation directive:** execution via subagent-driven-development with **Sonnet 5 implementer subagents** (`model: "sonnet"`); the coordinator specifies interfaces/AC and reviews; implementers write component code. Tasks 1–2 (state + pure utils) have full code in-plan; Tasks 3–6 are contracts + exact test code. Task 7 (verification gate) is run by the coordinator directly.

---

## Environment notes (implementers: read first)

- Work in worktree `D:\thematic-analysis-app\.claude\worktrees\zealous-colden-1e28e2`, branch `claude/zealous-colden-1e28e2` (continues from merged Phase 2).
- **Unit tests in this worktree need a testMatch override** (jest globs don't traverse dot-directories):
  `$env:CI="true"; npx react-scripts test --watchAll=false --testMatch "**/.claude/**/src/**/*.{spec,test}.{js,jsx,ts,tsx}"`
- E2E: `npx playwright test --reporter=list` (port 3000 free; auto-starts dev server). Single test: `-g "<title fragment>"`.
- Baseline entering this phase: **89 unit tests after Tasks 1–2 (65 today), 28 E2E today.**
- PowerShell is the shell. Do not run `npm install <pkg>` (prunes the no-save `@playwright/test`; nothing new is needed).

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/context/GraphContext.js` | Modify | `report` state key, `REPORT_*` reducer cases, persistence defaults, `withDefaults()` helper. **Bug #10 audit**: every object-literal return must carry `report`. |
| `src/context/GraphContext.report.test.js` | Create | 11 reducer/persistence tests. |
| `src/utils/reportUtils.js` | Create | Pure: `effectiveSections()`, `parseInline()`, `pullQuoteFor()`. No React, no d3. |
| `src/utils/reportUtils.test.js` | Create | 13 tests. |
| `src/components/report/ReportView.js` | Create | Mode state (edit/present), chapter list, empty state, present overlay, print root ids. |
| `src/components/report/ReportChapter.js` | Create | One chapter: color header, prose blocks (blur-commit), pull-quote margin, code tray, reorder buttons. |
| `src/components/report/ReportMiniMap.js` | Create | Static SVG wall render; active region highlight. |
| `src/components/report/reportPrint.css` | Create | `@media print` stylesheet. |
| `src/components/Toolbar.js` | Modify | Add `['report', '¶ Report']` to the switcher array (line ~97) + doc comment. |
| `src/App.js` | Modify | Import ReportView, 4-way render branch, `view` comment, `handleExportPdf` print path. |
| `e2e/app.spec.js` | Modify | Tests 29–31 (28 → 31). |
| `CLAUDE.md` | Modify | Task 7 only. |

**Interfaces locked here** (implementers must not rename): action types `REPORT_ADD_BLOCK`, `REPORT_UPDATE_BLOCK`, `REPORT_DELETE_BLOCK`, `REPORT_SET_ORDER`, `REPORT_ADD_PULL_QUOTE`, `REPORT_REMOVE_PULL_QUOTE`; utils `effectiveSections(report, nodes)`, `parseInline(text)`, `pullQuoteFor(codeId, nodes)`; testids `report-chapter`, `prose-block`, `pull-quote`, `report-minimap`, `report-edit`; ids `canvas-export-target` (edit-mode root, shared convention) and `report-print-root` (same element).

---

## Task 1: Report state in GraphContext (TDD — full code below)

**Goal:** `report.sections` lives in graph state with six `REPORT_*` reducer actions, correct persistence defaults, and no dropped keys anywhere (Bug #10).

**Files:**
- Modify: `src/context/GraphContext.js`
- Test: `src/context/GraphContext.report.test.js` (new)

**Acceptance Criteria:**
- [ ] `initialState`, `CLEAR`, `SET_GRAPH`, `migrateV1ToV2`, and the lazy initializer all produce/preserve a `report` key (default `{ sections: [] }`)
- [ ] `REPORT_ADD_BLOCK` upserts the section if missing and appends `{ id, text: '' }`
- [ ] `REPORT_UPDATE_BLOCK` / `REPORT_DELETE_BLOCK` touch only the targeted block
- [ ] `REPORT_SET_ORDER { themeIds }` rebuilds section order, materializing missing sections
- [ ] `REPORT_ADD_PULL_QUOTE` is idempotent per codeId; `REPORT_REMOVE_PULL_QUOTE` removes
- [ ] `DELETE_NODE` on a theme leaves its report section intact (tombstone data survives — design §4)
- [ ] Exported `withDefaults(parsed)` fills missing `regions`/`report` on old v2 saves and is used by the lazy initializer
- [ ] All 11 new tests pass; suite total 76; no existing test breaks

**Verify:** `$env:CI="true"; npx react-scripts test --watchAll=false --testMatch "**/.claude/**/src/**/*.{spec,test}.{js,jsx,ts,tsx}"` → `Test Suites: 6 passed` / `Tests: 76 passed`

**Steps:**

- [ ] **Step 1: Write the failing tests** — create `src/context/GraphContext.report.test.js`:

```js
/**
 * GraphContext.report.test.js
 * Phase 3: report state — sections, blocks, pull quotes, persistence defaults.
 */
import { graphReducer, migrateV1ToV2, withDefaults } from './GraphContext';

const base = (over = {}) => ({
  nodes: [], edges: [], regions: [], report: { sections: [] }, ...over,
});
const theme = (id, label = 'T') => ({ id, type: 'theme', label, color: '#4f46e5', x: 0, y: 0 });

describe('report reducer', () => {
  test('REPORT_ADD_BLOCK upserts the section and appends an empty block', () => {
    const s1 = graphReducer(base({ nodes: [theme('t1')] }), { type: 'REPORT_ADD_BLOCK', themeId: 't1', blockId: 'b1' });
    expect(s1.report.sections).toHaveLength(1);
    expect(s1.report.sections[0]).toEqual({ themeId: 't1', proseBlocks: [{ id: 'b1', text: '' }], pullQuoteIds: [] });
    expect(s1.nodes).toHaveLength(1); // rest of state intact
  });

  test('REPORT_UPDATE_BLOCK replaces only the targeted block text', () => {
    let s = graphReducer(base(), { type: 'REPORT_ADD_BLOCK', themeId: 't1', blockId: 'b1' });
    s = graphReducer(s, { type: 'REPORT_ADD_BLOCK', themeId: 't1', blockId: 'b2' });
    s = graphReducer(s, { type: 'REPORT_UPDATE_BLOCK', themeId: 't1', blockId: 'b1', text: 'hello' });
    expect(s.report.sections[0].proseBlocks).toEqual([
      { id: 'b1', text: 'hello' }, { id: 'b2', text: '' },
    ]);
  });

  test('REPORT_DELETE_BLOCK removes the block', () => {
    let s = graphReducer(base(), { type: 'REPORT_ADD_BLOCK', themeId: 't1', blockId: 'b1' });
    s = graphReducer(s, { type: 'REPORT_DELETE_BLOCK', themeId: 't1', blockId: 'b1' });
    expect(s.report.sections[0].proseBlocks).toEqual([]);
  });

  test('REPORT_SET_ORDER reorders and materializes missing sections', () => {
    let s = graphReducer(base(), { type: 'REPORT_ADD_BLOCK', themeId: 't1', blockId: 'b1' });
    s = graphReducer(s, { type: 'REPORT_SET_ORDER', themeIds: ['t2', 't1'] });
    expect(s.report.sections.map(x => x.themeId)).toEqual(['t2', 't1']);
    expect(s.report.sections[0].proseBlocks).toEqual([]);           // materialized fresh
    expect(s.report.sections[1].proseBlocks[0].id).toBe('b1');      // existing content kept
  });

  test('REPORT_ADD_PULL_QUOTE is idempotent per code', () => {
    let s = graphReducer(base(), { type: 'REPORT_ADD_PULL_QUOTE', themeId: 't1', codeId: 'c1' });
    s = graphReducer(s, { type: 'REPORT_ADD_PULL_QUOTE', themeId: 't1', codeId: 'c1' });
    expect(s.report.sections[0].pullQuoteIds).toEqual(['c1']);
  });

  test('REPORT_REMOVE_PULL_QUOTE removes the reference', () => {
    let s = graphReducer(base(), { type: 'REPORT_ADD_PULL_QUOTE', themeId: 't1', codeId: 'c1' });
    s = graphReducer(s, { type: 'REPORT_REMOVE_PULL_QUOTE', themeId: 't1', codeId: 'c1' });
    expect(s.report.sections[0].pullQuoteIds).toEqual([]);
  });

  test('CLEAR resets the report', () => {
    let s = graphReducer(base(), { type: 'REPORT_ADD_BLOCK', themeId: 't1', blockId: 'b1' });
    s = graphReducer(s, { type: 'CLEAR' });
    expect(s.report).toEqual({ sections: [] });
  });

  test('SET_GRAPH defaults report when absent and honors it when provided', () => {
    const absent = graphReducer(base(), { type: 'SET_GRAPH', nodes: [], edges: [] });
    expect(absent.report).toEqual({ sections: [] });
    const given = graphReducer(base(), {
      type: 'SET_GRAPH', nodes: [], edges: [],
      report: { sections: [{ themeId: 't1', proseBlocks: [], pullQuoteIds: [] }] },
    });
    expect(given.report.sections).toHaveLength(1);
  });

  test('deleting a theme keeps its report section (tombstone survives)', () => {
    let s = graphReducer(base({ nodes: [theme('t1')] }), { type: 'REPORT_ADD_BLOCK', themeId: 't1', blockId: 'b1' });
    s = graphReducer(s, { type: 'DELETE_NODE', id: 't1' });
    expect(s.nodes).toHaveLength(0);
    expect(s.report.sections[0].proseBlocks[0].id).toBe('b1');
  });
});

describe('report persistence defaults', () => {
  test('withDefaults fills missing regions and report, preserves provided values', () => {
    expect(withDefaults({ nodes: [], edges: [] })).toEqual({
      nodes: [], edges: [], regions: [], report: { sections: [] },
    });
    const full = { nodes: [], edges: [], regions: [{ id: 'r' }], report: { sections: [{ themeId: 't1', proseBlocks: [], pullQuoteIds: [] }] } };
    expect(withDefaults(full)).toEqual(full);
  });

  test('migrateV1ToV2 output includes an empty report', () => {
    const out = migrateV1ToV2({ nodes: [theme('t1')], edges: [] });
    expect(out.report).toEqual({ sections: [] });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `$env:CI="true"; npx react-scripts test --watchAll=false --testMatch "**/.claude/**/src/**/*.{spec,test}.{js,jsx,ts,tsx}" --testPathPattern GraphContext.report`
Expected: FAIL — `withDefaults` is not exported / REPORT_ADD_BLOCK falls through to default case.

- [ ] **Step 3: Implement in `src/context/GraphContext.js`** — five precise edits:

3a. Header doc comment: add to STATE SHAPE — `report — { sections: [{ themeId, proseBlocks: [{id, text}], pullQuoteIds: [codeId] }] } (Living Report chapters; ids reference nodes — renames flow through, deletions tombstone)` and list the six REPORT_* actions under ACTIONS.

3b. Below `SEED_REGION`, add the defaults helper and export it:

```js
/** Fill top-level keys missing from older saves. Exported for tests. */
export function withDefaults(parsed) {
  return { regions: [], report: { sections: [] }, ...parsed };
}
```

3c. `initialState` gains the key:

```js
const initialState = {
  nodes: [],
  edges: [],
  regions: [],
  report: { sections: [] },
};
```

3d. Reducer additions — module-scope helper above `graphReducer`:

```js
/** Return a report whose sections include themeId (upsert, order-preserving). */
function upsertSection(report, themeId) {
  const sections = report?.sections ?? [];
  if (sections.some(s => s.themeId === themeId)) return { sections };
  return { sections: [...sections, { themeId, proseBlocks: [], pullQuoteIds: [] }] };
}
```

New cases inside `graphReducer` (before `case 'SET_GRAPH'`):

```js
    case 'REPORT_ADD_BLOCK': {
      const report = upsertSection(state.report, action.themeId);
      return {
        ...state,
        report: {
          sections: report.sections.map(s =>
            s.themeId === action.themeId
              ? { ...s, proseBlocks: [...s.proseBlocks, { id: action.blockId, text: '' }] }
              : s
          ),
        },
      };
    }

    case 'REPORT_UPDATE_BLOCK': {
      return {
        ...state,
        report: {
          sections: (state.report?.sections ?? []).map(s =>
            s.themeId === action.themeId
              ? { ...s, proseBlocks: s.proseBlocks.map(b => (b.id === action.blockId ? { ...b, text: action.text } : b)) }
              : s
          ),
        },
      };
    }

    case 'REPORT_DELETE_BLOCK': {
      return {
        ...state,
        report: {
          sections: (state.report?.sections ?? []).map(s =>
            s.themeId === action.themeId
              ? { ...s, proseBlocks: s.proseBlocks.filter(b => b.id !== action.blockId) }
              : s
          ),
        },
      };
    }

    case 'REPORT_SET_ORDER': {
      const existing = new Map((state.report?.sections ?? []).map(s => [s.themeId, s]));
      return {
        ...state,
        report: {
          sections: action.themeIds.map(id =>
            existing.get(id) ?? { themeId: id, proseBlocks: [], pullQuoteIds: [] }
          ),
        },
      };
    }

    case 'REPORT_ADD_PULL_QUOTE': {
      const report = upsertSection(state.report, action.themeId);
      return {
        ...state,
        report: {
          sections: report.sections.map(s =>
            s.themeId === action.themeId && !s.pullQuoteIds.includes(action.codeId)
              ? { ...s, pullQuoteIds: [...s.pullQuoteIds, action.codeId] }
              : s
          ),
        },
      };
    }

    case 'REPORT_REMOVE_PULL_QUOTE': {
      return {
        ...state,
        report: {
          sections: (state.report?.sections ?? []).map(s =>
            s.themeId === action.themeId
              ? { ...s, pullQuoteIds: s.pullQuoteIds.filter(id => id !== action.codeId) }
              : s
          ),
        },
      };
    }
```

Replace the existing `SET_GRAPH` and `CLEAR` cases:

```js
    case 'SET_GRAPH':
      return {
        nodes: action.nodes,
        edges: action.edges,
        regions: action.regions ?? [],
        report: action.report ?? { sections: [] },
      };

    case 'CLEAR':
      return { nodes: [], edges: [], regions: [], report: { sections: [] } };
```

3e. Persistence plumbing:
- In `migrateV1ToV2`, change the return to `return { nodes, edges, regions, report: { sections: [] } };`
- In the lazy initializer, replace `return { past: [], present: { regions: [], ...parsed }, future: [] };` with `return { past: [], present: withDefaults(parsed), future: [] };` (keep the surrounding comment, updating "regions" → "regions/report").

No `isUndoable` change: `REPORT_*` actions are undoable by default (they're analytic acts; the view commits prose on blur so typing doesn't spam history — one history entry per edit session).

- [ ] **Step 4: Run the full unit suite**

Run: `$env:CI="true"; npx react-scripts test --watchAll=false --testMatch "**/.claude/**/src/**/*.{spec,test}.{js,jsx,ts,tsx}"`
Expected: `Test Suites: 6 passed` / `Tests: 76 passed` (65 + 11)

- [ ] **Step 5: Commit**

```powershell
git add src/context/GraphContext.js src/context/GraphContext.report.test.js
git commit -m "feat: report state - sections/blocks/pull-quote reducer actions, persistence defaults"
```

---

## Task 2: reportUtils — pure chapter/inline/pull-quote helpers (TDD — full code below)

**Goal:** Dependency-free helpers the report components lean on: effective chapter derivation with auto-seeding + tombstones, bold/italic inline parsing, pull-quote resolution.

**Files:**
- Create: `src/utils/reportUtils.js`
- Test: `src/utils/reportUtils.test.js`

**Acceptance Criteria:**
- [ ] `effectiveSections(report, nodes)`: stored sections keep order with live `theme` attached; sections whose theme was deleted get `theme: null`; themes with no stored section are appended in node order with empty blocks/quotes
- [ ] `parseInline(text)`: `**bold**` → bold token, `*italic*` → italic token, unmatched markers stay literal text, empty string → `[]`
- [ ] `pullQuoteFor(codeId, nodes)`: live code → `{tombstone: false, label, quote, source, color}`; missing/non-code id → `{tombstone: true, ...}`
- [ ] No React/d3 imports; all 13 tests pass; suite total 89

**Verify:** `$env:CI="true"; npx react-scripts test --watchAll=false --testMatch "**/.claude/**/src/**/*.{spec,test}.{js,jsx,ts,tsx}"` → `Test Suites: 7 passed` / `Tests: 89 passed`

**Steps:**

- [ ] **Step 1: Write the failing tests** — create `src/utils/reportUtils.test.js`:

```js
/**
 * reportUtils.test.js — pure Living Report helpers.
 */
import { effectiveSections, parseInline, pullQuoteFor } from './reportUtils';

const theme = (id, label) => ({ id, type: 'theme', label, color: '#4f46e5', x: 0, y: 0 });
const code = (id, label, over = {}) =>
  ({ id, type: 'code', label, quote: '', source: '', primaryThemeId: null, color: '#6b7280', x: 0, y: 0, ...over });
const section = (themeId, over = {}) => ({ themeId, proseBlocks: [], pullQuoteIds: [], ...over });

describe('effectiveSections', () => {
  test('auto-seeds one section per theme in node order when report is empty', () => {
    const out = effectiveSections({ sections: [] }, [theme('t1', 'A'), theme('t2', 'B')]);
    expect(out.map(s => s.themeId)).toEqual(['t1', 't2']);
    expect(out[0].theme.label).toBe('A');
    expect(out[0].proseBlocks).toEqual([]);
  });

  test('keeps stored order and appends unstored themes after', () => {
    const out = effectiveSections({ sections: [section('t2')] }, [theme('t1', 'A'), theme('t2', 'B')]);
    expect(out.map(s => s.themeId)).toEqual(['t2', 't1']);
  });

  test('section for a deleted theme survives with theme: null (tombstone)', () => {
    const out = effectiveSections(
      { sections: [section('ghost', { proseBlocks: [{ id: 'b1', text: 'kept' }] })] },
      [theme('t1', 'A')]
    );
    expect(out[0].theme).toBeNull();
    expect(out[0].proseBlocks[0].text).toBe('kept');
    expect(out[1].themeId).toBe('t1');
  });

  test('carries stored blocks and pull quote ids through', () => {
    const out = effectiveSections(
      { sections: [section('t1', { proseBlocks: [{ id: 'b1', text: 'x' }], pullQuoteIds: ['c9'] })] },
      [theme('t1', 'A')]
    );
    expect(out[0].pullQuoteIds).toEqual(['c9']);
    expect(out[0].theme.label).toBe('A');
  });

  test('tolerates undefined report', () => {
    expect(effectiveSections(undefined, [theme('t1', 'A')])).toHaveLength(1);
  });
});

describe('parseInline', () => {
  test('plain text is one text token', () => {
    expect(parseInline('hello world')).toEqual([{ type: 'text', content: 'hello world' }]);
  });

  test('double-star spans become bold tokens', () => {
    expect(parseInline('a **b** c')).toEqual([
      { type: 'text', content: 'a ' },
      { type: 'bold', content: 'b' },
      { type: 'text', content: ' c' },
    ]);
  });

  test('single-star spans become italic tokens', () => {
    expect(parseInline('*i*')).toEqual([{ type: 'italic', content: 'i' }]);
  });

  test('mixed bold and italic in one string', () => {
    expect(parseInline('**b** and *i*').map(t => t.type)).toEqual(['bold', 'text', 'italic']);
  });

  test('unclosed markers stay literal', () => {
    expect(parseInline('2 ** 3')).toEqual([{ type: 'text', content: '2 ** 3' }]);
  });

  test('empty string yields no tokens', () => {
    expect(parseInline('')).toEqual([]);
  });
});

describe('pullQuoteFor', () => {
  test('resolves a live code with its quote, source and color', () => {
    const out = pullQuoteFor('c1', [code('c1', 'Checking', { quote: 'I check.', source: 'Interview_01', color: '#059669' })]);
    expect(out).toEqual({ tombstone: false, label: 'Checking', quote: 'I check.', source: 'Interview_01', color: '#059669' });
  });

  test('missing code id yields a tombstone', () => {
    const out = pullQuoteFor('gone', []);
    expect(out.tombstone).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `--testPathPattern reportUtils` → FAIL `Cannot find module './reportUtils'`

- [ ] **Step 3: Implement** — create `src/utils/reportUtils.js`:

```js
/**
 * reportUtils.js
 * ──────────────────────────────────────────────────────────────────────────
 * Pure helpers for the Living Report view. No React, no d3 — unit-testable
 * under CRA jest.
 *
 * effectiveSections(report, nodes)
 *   The report's stored sections in order, each with a live `theme` node
 *   attached (or null → tombstone chapter), followed by auto-seeded empty
 *   sections for themes not yet in the report. Auto-seeding happens here at
 *   derivation time — never by dispatching during render.
 *
 * parseInline(text)
 *   Tokenizes the bold/italic-only prose markup (**bold**, *italic*) into
 *   [{type: 'text'|'bold'|'italic', content}]. Unmatched markers stay
 *   literal. Components map tokens to <strong>/<em> — no HTML strings.
 *
 * pullQuoteFor(codeId, nodes)
 *   Resolves a pull-quote reference to display data; missing codes become
 *   tombstones (design §4: report tolerates dangling references).
 */

export function effectiveSections(report, nodes) {
  const themes = nodes.filter(n => n.type === 'theme');
  const themesById = new Map(themes.map(t => [t.id, t]));
  const stored = report?.sections ?? [];
  const storedIds = new Set(stored.map(s => s.themeId));
  return [
    ...stored.map(s => ({ ...s, theme: themesById.get(s.themeId) ?? null })),
    ...themes
      .filter(t => !storedIds.has(t.id))
      .map(t => ({ themeId: t.id, proseBlocks: [], pullQuoteIds: [], theme: t })),
  ];
}

const INLINE_RE = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;

export function parseInline(text) {
  const tokens = [];
  let last = 0;
  let m;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', content: text.slice(last, m.index) });
    if (m[2] !== undefined) tokens.push({ type: 'bold', content: m[2] });
    else tokens.push({ type: 'italic', content: m[4] });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ type: 'text', content: text.slice(last) });
  return tokens;
}

export function pullQuoteFor(codeId, nodes) {
  const code = nodes.find(n => n.id === codeId && n.type === 'code');
  if (!code) return { tombstone: true, label: 'Removed code', quote: null, source: null, color: null };
  return {
    tombstone: false,
    label: code.label,
    quote: code.quote || '',
    source: code.source || '',
    color: code.color,
  };
}
```

Note on `'2 ** 3'`: the bold alternative requires a non-star char between the markers and the italic alternative can't span the inner ` ** `, so neither matches — the whole string stays one literal text token. (`*italic*` still matches because `[^*]+` accepts spaces.)

- [ ] **Step 4: Full unit suite** → `Test Suites: 7 passed` / `Tests: 89 passed`

- [ ] **Step 5: Commit**

```powershell
git add src/utils/reportUtils.js src/utils/reportUtils.test.js
git commit -m "feat: pure report helpers - effective sections, inline markup parser, pull-quote resolution"
```

---

## Task 3: View wiring + ReportView shell (read-only chapters, empty state)

**Goal:** A fourth "¶ Report" switcher entry mounts ReportView: auto-seeded chapters render read-only with the report typography, plus an empty state when no themes exist.

**Files:**
- Modify: `src/components/Toolbar.js` (~line 97 switcher array: append `['report', '¶ Report']`; update the `view` doc comment to `{'wall'|'graph'|'sankey'|'report'}`)
- Modify: `src/App.js` (import `ReportView from './components/report/ReportView'`; view comment → `'wall' | 'graph' | 'sankey' | 'report'`; extend the render chain with `: view === 'sankey' ? (<SankeyView …existing props…>) : (<ReportView />)` — keep Canvas/WallView/SankeyView JSX byte-identical)
- Create: `src/components/report/ReportView.js`
- Create: `src/components/report/ReportChapter.js`
- Test: `e2e/app.spec.js` (append test 29 — code below)

**Component contract — ReportView (this task's scope: edit-mode rendering only):**
- No props. Reads `const { nodes, report } = useGraph()`.
- Derives `const sections = effectiveSections(report, nodes)` (import from `../../utils/reportUtils`).
- **No themes AND no stored sections** → empty-state box, visually identical pattern to SankeyView's (white card, `border-2 border-[#0f0d0a]`, `shadow-[8px_8px_0_#0f0d0a]`): heading "No chapters yet", body "Each theme becomes a chapter of your findings. Add themes in the Graph or Wall view, then write the story here."
- Otherwise: a scrollable column (`flex-1 overflow-y-auto`, background `var(--bg-canvas)`) containing a centered article: `<div id="canvas-export-target" data-testid="report-edit">` wrapping `<article id="report-print-root" style={{ maxWidth: '68ch', margin: '0 auto', fontSize: 17, lineHeight: 1.6, padding: '48px 24px' }}>` → one `<ReportChapter>` per section. (Both ids on THIS view's elements — the shared export-target convention plus the print root added in Task 6.)
- Renders `mode="edit"` chapters; present mode is Task 6 (add a `mode` state now, hardwired `'edit'`, so Task 6 only adds the overlay).

**Component contract — ReportChapter (this task's scope: header + read-only prose):**
- Props: `{ section, mode }` (+ reorder props arrive in Task 4 — accept and ignore extra props gracefully).
- Root: `<section data-testid="report-chapter">` with 40px bottom margin.
- Header: 8px-tall color bar (`section.theme?.color ?? '#6b6560'`) above an `<h2>` — `section.theme ? section.theme.label : '(deleted theme)'` (italic + gray when tombstone). Bricolage inherits; `fontWeight: 700`, `fontSize: 28`.
- Prose blocks (read-only in this task): each `proseBlock` renders `<p data-testid="prose-block">` whose children come from `parseInline(block.text)` mapped: `text` → string, `bold` → `<strong>`, `italic` → `<em>` (key by index). No block controls yet.
- Follow repo conventions (CLAUDE.md): functional components, Tailwind for layout + inline style for dynamic values, no `var(--css-var)` inside Tailwind arbitrary values.

**Acceptance Criteria:**
- [ ] Switcher shows Wall · Graph · Sankey · Report; Report sets `aria-pressed="true"` and mounts ReportView; graph-only actions disable (existing `graphOnly` mechanism, no Toolbar logic change)
- [ ] With one theme, exactly one `[data-testid="report-chapter"]` renders showing the theme's label; chapters auto-seed without any dispatch during render
- [ ] Empty state renders when there are no themes and no stored sections
- [ ] `id="canvas-export-target"` lives on the report edit root (PNG export works); nothing else carries that id while Report is mounted
- [ ] E2E test 29 passes; existing 28 E2E stay green (spot-check tests 22 and 26)

**Verify:** `npx playwright test -g "Report view seeds chapters" --reporter=list` → `1 passed`

**E2E test 29 (append to `e2e/app.spec.js` — exact code, includes Task 4's editing flow; write the test in THIS task with the editing steps commented out and a `// TODO(Task 4)` marker is a plan failure — instead, this task appends only the seeding half, and Task 4 extends it):**

```js
// ── 29. Report view — chapter seeding ───────────────────────────────────────

test('29 — Report view seeds a chapter per theme', async ({ page }) => {
  await page.getByRole('button', { name: /Add Theme/i }).click();
  await page.getByRole('button', { name: /Report/ }).click();
  await expect(page.getByRole('button', { name: /Report/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /Connect/ })).toBeDisabled();
  await expect(page.locator('[data-testid="report-chapter"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="report-chapter"]').first()).toContainText('New Theme');
});
```

**Steps:** append the switcher entry → write ReportView + ReportChapter to the contracts above → wire App.js → append e2e 29 → run it plus `-g "view switcher"` and `-g "Sankey view shows empty-state"` (regression) → run the unit suite (no regressions) → commit `feat: report view switcher entry, auto-seeded read-only chapters, empty state`.

---

## Task 4: Prose editing — blocks, blur-commit, chapter reorder

**Goal:** Chapters become writable: add/edit/delete paragraphs (committed to state on blur so undo gets one entry per edit session) and reorder chapters.

**Files:**
- Modify: `src/components/report/ReportView.js`
- Modify: `src/components/report/ReportChapter.js`
- Test: `e2e/app.spec.js` (replace test 29 with the extended version below)

**Behavior contract:**
- Each prose block in edit mode is click-to-edit: rendered `<p data-testid="prose-block">` (parseInline output) normally; clicking it (or focusing via keyboard — the `<p>` gets `tabIndex={0}` `role="button"` `aria-label="Edit paragraph"`) swaps to a `<textarea>` inside the same `data-testid="prose-block"` wrapper, autofocused, holding the RAW text (with `**`/`*` markers). Local `useState` while typing; on blur: dispatch `REPORT_UPDATE_BLOCK` **only if text changed**, then swap back to rendered view. Escape in the textarea cancels (reverts local value, no dispatch).
- Newly added blocks (empty text) render straight into textarea mode.
- "＋ Add paragraph" button per chapter (edit mode only, `aria-label` matching `/Add paragraph/i`): dispatches `REPORT_ADD_BLOCK { themeId: section.themeId, blockId: makeId('block') }` (import `makeId` from GraphContext).
- Per-block "✕" delete button (edit mode only, visible on block hover, `aria-label="Delete paragraph"`): `window.confirm` then `REPORT_DELETE_BLOCK`.
- Chapter reorder: "↑"/"↓" buttons in the chapter header (edit mode only; first/last disabled). ReportView owns the handler: compute `const ids = sections.map(s => s.themeId)`, swap the two positions, dispatch `REPORT_SET_ORDER { themeIds: ids }`. Pass `onMoveUp/onMoveDown/isFirst/isLast` into ReportChapter.
- Textarea styling: full-width, transparent background, same 17px/1.6 type, `border-2 border-[#dc2626]` while active (visible editing affordance), auto-grows (set `rows={Math.max(2, value.split('\n').length)}`).

**Acceptance Criteria:**
- [ ] Add paragraph → textarea appears; typing + blur persists (survives switching views and back)
- [ ] Blur with unchanged text dispatches nothing (verify: no-op — implementer asserts via reducer behavior, not console)
- [ ] Escape in textarea reverts without saving
- [ ] Delete removes the block after confirm
- [ ] ↑/↓ reorder chapters and the order survives view switches (REPORT_SET_ORDER materializes)
- [ ] `**bold**` typed in a block renders as `<strong>` after blur
- [ ] Extended e2e 29 passes; unit suite stays 89

**Verify:** `npx playwright test -g "Report view seeds chapters" --reporter=list` → `1 passed`

**E2E — replace test 29 in full with:**

```js
// ── 29. Report view — chapter seeding + prose editing ───────────────────────

test('29 — Report view seeds a chapter per theme and saves prose on blur', async ({ page }) => {
  await page.getByRole('button', { name: /Add Theme/i }).click();
  await page.getByRole('button', { name: /Report/ }).click();
  await expect(page.getByRole('button', { name: /Report/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /Connect/ })).toBeDisabled();
  await expect(page.locator('[data-testid="report-chapter"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="report-chapter"]').first()).toContainText('New Theme');

  // Write a paragraph; blur commits it to the store
  await page.getByRole('button', { name: /Add paragraph/i }).first().click();
  const textarea = page.locator('[data-testid="prose-block"] textarea').first();
  await textarea.fill('Participants described **checking** rituals.');
  await textarea.blur();
  await expect(page.locator('[data-testid="prose-block"] strong').first()).toHaveText('checking');

  // Round-trip through another view proves it re-renders from state, not local memory
  await page.getByRole('button', { name: /Graph/ }).click();
  await page.getByRole('button', { name: /Report/ }).click();
  await expect(page.locator('[data-testid="prose-block"]').first()).toContainText('Participants described');
});
```

**Steps:** implement the contract → replace e2e 29 → run it → unit suite → commit `feat: report prose editing - blur-commit blocks, add/delete, chapter reorder`.

---

## Task 5: Pull quotes — margin slots, per-chapter tray, drag + click, tombstones

**Goal:** Codes become pull quotes in each chapter's margin — dragged from a per-chapter tray or added via a click affordance — and removed codes degrade to tombstone notes.

**Files:**
- Modify: `src/components/report/ReportChapter.js`
- Test: `e2e/app.spec.js` (append test 30 — exact code below)

**Behavior contract:**
- Chapter body becomes a two-column grid in **both** modes: `display: grid; gridTemplateColumns: '1fr 220px'; gap: 24px` — prose left, margin right. (Header spans full width above the grid.)
- **Margin column**: renders each `section.pullQuoteIds` entry via `pullQuoteFor(codeId, nodes)`:
  - Live: `<blockquote data-testid="pull-quote">` — 3px left border in `q.color`, quote text italic 15px (or "No quote recorded" gray when empty), code label bold 13px, source uppercase 12px gray. Matches QuoteTooltip's content hierarchy.
  - Tombstone: same testid, gray dashed left border, italic gray note `Removed code — this quote's source was deleted.`
  - Edit mode only: small "✕" remove button per quote (`aria-label="Remove pull quote"`) → `REPORT_REMOVE_PULL_QUOTE`.
- **Margin is a drop zone** (edit mode): on `dragover` preventDefault + 2px dashed `#dc2626` outline; on `drop` read `e.dataTransfer.getData('text/ta-code-id')` and dispatch `REPORT_ADD_PULL_QUOTE { themeId: section.themeId, codeId }`.
- **Code tray** (edit mode only): collapsible strip under the chapter header — heading "CODES" (12px, letter-spacing, gray), horizontally wrapping chips for `nodes.filter(n => n.type === 'code' && n.primaryThemeId === section.themeId)`. Each chip: label on a white card with the code's color as a 3px left border, `draggable` with `onDragStart` setting `text/ta-code-id`, plus a "❝" button `aria-label={'Add as pull quote: ' + code.label}` → same `REPORT_ADD_PULL_QUOTE` dispatch (the accessible/testable path). Chips whose code is already a pull quote render at 40% opacity with the button disabled.
- Reducer idempotence (Task 1) makes double-adds safe.

**Acceptance Criteria:**
- [ ] Click affordance adds the pull quote to the chapter margin; chip dims and disables once added
- [ ] HTML5 drag from chip to margin also adds (manual/preview verification — not e2e)
- [ ] Removing works; deleting the code node in Graph view leaves a tombstone note in the margin
- [ ] Present-mode rendering unaffected for now (margin renders; no tray, no buttons — guard everything editorial behind `mode === 'edit'`)
- [ ] E2E test 30 passes; suites stay green (89 unit / 30 e2e)

**Verify:** `npx playwright test -g "pull quotes render and tombstone" --reporter=list` → `1 passed`

**E2E test 30 (append — exact code):**

```js
// ── 30. Report pull quotes + tombstones ─────────────────────────────────────

test('30 — pull quotes render and tombstone when their code is deleted', async ({ page }) => {
  // Seed a theme + connected code (same flow as test 4)
  await page.getByRole('button', { name: /Add Theme/i }).click();
  await page.getByRole('button', { name: /Add Code/i }).click();
  await page.getByRole('button', { name: /Connect/i }).click();
  const codeNode  = page.locator('.nodes-layer > div').filter({ hasNotText: /✓/ }).first();
  const themeNode = page.locator('[role="button"][aria-label*="theme"]').first();
  await codeNode.click({ force: true });
  await themeNode.click({ force: true });
  await page.getByRole('button', { name: /Cancel Connect/i }).click();

  // Add the code as a pull quote via the tray's click affordance
  await page.getByRole('button', { name: /Report/ }).click();
  await page.getByRole('button', { name: /Add as pull quote/i }).first().click();
  await expect(page.locator('[data-testid="pull-quote"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="pull-quote"]').first()).toContainText('New Code');

  // Delete the code in Graph view → tombstone note in the Report margin
  page.on('dialog', d => d.accept());
  await page.getByRole('button', { name: /Graph/ }).click();
  const codeAgain = page.locator('.nodes-layer > div').filter({ hasNotText: /✓/ }).first();
  await codeAgain.click({ button: 'right', force: true });
  const deleteBtn = page.getByRole('menuitem', { name: /Delete Node/i });
  await expect(deleteBtn).toBeVisible({ timeout: 3000 });
  await deleteBtn.click();
  await page.getByRole('button', { name: /Report/ }).click();
  await expect(page.locator('[data-testid="pull-quote"]').first()).toContainText(/Removed code/i);
});
```

**Steps:** implement the contract → append e2e 30 → run it → unit suite → verify drag manually in the preview server (config `sankey-worktree`, port 3101) → commit `feat: report pull quotes - margin slots, code tray, drag and click affordances, tombstones`.

---

## Task 6: Present mode, wall mini-map, pull-quote motion, print export

**Goal:** "▶ Present" opens a full-screen reading mode with a fixed mini-map that highlights the current theme's wall region while scrolling; pull quotes animate in; the PDF button prints the report through a print stylesheet.

**Files:**
- Modify: `src/components/report/ReportView.js`
- Create: `src/components/report/ReportMiniMap.js`
- Create: `src/components/report/reportPrint.css` (imported at the top of ReportView.js)
- Modify: `src/components/report/ReportChapter.js` (present-mode pull-quote motion wrapper only)
- Modify: `src/App.js` (`handleExportPdf` print path)
- Modify: `src/utils/motionConfig.js` (add `pullQuoteVariants`)
- Test: `e2e/app.spec.js` (append test 31 — exact code below)

**Behavior contract — present mode (ReportView):**
- Edit-mode header row (right-aligned above the article, edit mode only) holds a "▶ Present" button (hidden when the empty state shows).
- `mode === 'present'`: render the fixed overlay **instead of** the edit article (the edit root, its buttons, and `canvas-export-target` unmount — e2e 31 asserts zero "Add paragraph" buttons; PNG export is a no-op in present mode via App's existing null guard). Overlay: `className="fixed inset-0 z-40 overflow-y-auto"` style `{ backgroundColor: 'var(--bg-canvas)' }`, containing the same centered 68ch article (`mode="present"` chapters — no tray/buttons/textareas) with `id="report-print-root"` moving onto the overlay's article while presenting, plus:
  - "✕ Exit" pill (fixed top-right, `border-2 border-[#0f0d0a] bg-[#0f0d0a] text-white`) → back to edit
  - Escape exits (guarded listener: `if (mode !== 'present') return;` — the modal-Escape convention)
  - `<ReportMiniMap regions={regions} nodes={nodes} activeThemeId={activeThemeId} />`
- **Active chapter tracking:** `onScroll` on the overlay; chapter roots register refs (`chapterRefs.current[themeId]`); active = the LAST chapter whose `offsetTop <= scrollTop + viewportHeight / 3`. Recompute on scroll (a plain handler is fine — ~4 chapters; no observer needed) and initialize to the first section on entering present mode.

**Component contract — ReportMiniMap:**
- Props: `{ regions, nodes, activeThemeId }`. Returns `null` if `regions` is empty.
- Fixed card bottom-right (`fixed bottom-4 right-4 z-50`), 200×140, white, `border-2 border-[#0f0d0a] shadow-[4px_4px_0_#0f0d0a]`, `data-testid="report-minimap"`.
- One `<svg>` with `viewBox` = the bounding box of all region rects (+24 padding), `preserveAspectRatio="xMidYMid meet"`.
- Each region: `<rect>` at its `rect` geometry, fill = its theme's color (look up `nodes` by `region.themeId`) at `fillOpacity={region.themeId === activeThemeId ? 0.55 : 0.18}`, stroke same color, `strokeWidth={region.themeId === activeThemeId ? 6 : 2}`.
- Code dots: for codes with a `wallPosition`, `<circle r={6} fill="#6b6560" opacity={0.5}>` at that position.
- Static — no zoom, no interaction, `pointerEvents: 'none'` on the svg.

**Motion:** in `motionConfig.js` add (below `tooltipVariants`):

```js
/** Pull-quote entrance in report present mode — used with whileInView */
export const pullQuoteVariants = {
  hidden:  { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: springs.entrance },
};
```

In ReportChapter, present-mode pull quotes wrap in `<motion.div variants={pullQuoteVariants} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.4 }}>` (edit mode: no motion wrapper).

**Print export:**
- `reportPrint.css`:

```css
/* Print stylesheet — Living Report → text-selectable PDF via the browser.
   Visibility (not display) so the report keeps its layout box in print flow. */
@media print {
  body * { visibility: hidden; }
  #report-print-root, #report-print-root * { visibility: visible; }
  #report-print-root { position: absolute; left: 0; top: 0; width: 100%; max-width: 68ch; }
  [data-testid="report-chapter"] { break-inside: avoid-page; }
  button, textarea { display: none !important; }
}
```

- `App.js` `handleExportPdf` becomes:

```js
  async function handleExportPdf() {
    // Report exports as a real text document via the print stylesheet
    // (design §4) — html2canvas would rasterize the prose.
    if (view === 'report') { window.print(); return; }
    const el = document.getElementById('canvas-export-target');
    if (el) await exportToPdf(el);
  }
```

**Acceptance Criteria:**
- [ ] Present shows the overlay with chapters read-only, exit pill, and mini-map; Escape and the pill both return to edit
- [ ] Mini-map highlights the active chapter's region and updates while scrolling (manual/preview check); absent when no regions exist
- [ ] Pull quotes slide in on first scroll into view (present mode only)
- [ ] ↓ PDF in Report view opens the browser print dialog (manual check); other views keep html2canvas behavior (e2e 22/26 regressions green)
- [ ] E2E test 31 passes; suites stay green

**Verify:** `npx playwright test -g "present mode" --reporter=list` → `1 passed`

**E2E test 31 (append — exact code):**

```js
// ── 31. Report present mode ─────────────────────────────────────────────────

test('31 — present mode shows the mini-map and Escape returns to edit', async ({ page }) => {
  await page.getByRole('button', { name: /Add Theme/i }).click(); // theme ⇒ a wall region exists
  await page.getByRole('button', { name: /Report/ }).click();
  await page.getByRole('button', { name: /Present/ }).click();

  await expect(page.locator('[data-testid="report-minimap"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /Add paragraph/i })).toHaveCount(0); // edit chrome hidden

  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="report-minimap"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Present/ })).toBeVisible();
});
```

**Steps:** implement present overlay + tracking → ReportMiniMap → motion variants + wrapper → print css + App PDF path → append e2e 31 → run it plus `-g "Report view seeds"` and `-g "pull quotes"` → unit suite → verify mini-map highlight + print dialog in the preview server → commit `feat: report present mode - wall mini-map, pull-quote motion, print-stylesheet PDF export`.

---

## Task 7: Full-suite verification gate + docs (coordinator-run)

**Goal:** Prove the full unit suite (89 tests, 7 suites) and full E2E suite (31 tests) pass with all pre-existing tests green, production build compiles, and CLAUDE.md documents Phase 3.

> **USER-ORDERED GATE — NON-SKIPPABLE.** This task was requested by the user in the current conversation. It MUST NOT be closed by walking around it, by declaring it "verified inline", or by substituting a cheaper check. Close only after every item in `acceptanceCriteria` has been re-validated independently, with output captured.

**Files:**
- Modify: `CLAUDE.md`

**Acceptance Criteria:**
- [ ] Full unit suite output captured: `Test Suites: 7 passed` / `Tests: 89 passed` — no pre-existing test broken
- [ ] Full E2E suite output captured: `31 passed` — no pre-existing test broken
- [ ] `npm run build` compiles; `npx eslint src/components/report src/utils/reportUtils.js src/context/GraphContext.js --max-warnings 0` reports clean (pre-existing Canvas.js warning is tracked separately — not in scope)
- [ ] CLAUDE.md updated: commands (89 unit / 31 E2E), view row adds `'report'`, Key Files adds `report/` + `reportUtils.js`, State Shape adds `report`, reducer actions list adds the six `REPORT_*` actions, Export-ID bullet notes the report edit root, e2e count line
- [ ] All working-tree changes committed

**Verify:** `$env:CI="true"; npx react-scripts test --watchAll=false --testMatch "**/.claude/**/src/**/*.{spec,test}.{js,jsx,ts,tsx}"` → `Tests: 89 passed, 89 total`; `npx playwright test --reporter=list` → `31 passed`; `npm run build` → compiles

**Steps:** run and capture the three verify commands → eslint the new files → apply the CLAUDE.md edits (exact deltas mirror the Phase 2 pattern; the reducer-actions line becomes `… UNASSIGN_CODE REPORT_ADD_BLOCK REPORT_UPDATE_BLOCK REPORT_DELETE_BLOCK REPORT_SET_ORDER REPORT_ADD_PULL_QUOTE REPORT_REMOVE_PULL_QUOTE SET_GRAPH CLEAR`; State Shape gains `report: { sections: [{ themeId, proseBlocks: [{id, text}], pullQuoteIds }] }` with a one-line tombstone note) → commit `test+docs: phase-3 verification, CLAUDE.md living-report updates`.

---

## Subagent execution notes (coordinator)

- Dispatch Tasks 1–6 to **Sonnet 5** implementer subagents (`model: "sonnet"`), one fresh subagent per task, sequential (every task depends on its predecessor). Include in each prompt: the full task section from this plan, the Environment notes block, and the interface lock list from File Structure.
- Coordinator reviews each task's diff + verify output before marking complete (code-reviewer subagent optional for Tasks 4–6, the UI-heavy ones).
- Task 7 is coordinator-run — the gate must not be delegated.
- Implementers must NOT: run `npm install`, touch files outside their task's list, rename locked interfaces, or fix the pre-existing Canvas.js lint warning.

## Out of scope (YAGNI, per design §5)

Rich text beyond bold/italic, comments/collaboration, report versioning/snapshots, exporting individual chapters, Metro-map lens, retiring Graph view, drag-reordering of prose blocks (↑/↓ per chapter is chapters-only; block order is append/delete).


