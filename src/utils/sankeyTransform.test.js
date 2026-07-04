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
