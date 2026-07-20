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
