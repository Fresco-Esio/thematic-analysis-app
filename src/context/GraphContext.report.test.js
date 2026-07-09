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
