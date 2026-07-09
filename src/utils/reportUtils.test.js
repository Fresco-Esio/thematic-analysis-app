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
