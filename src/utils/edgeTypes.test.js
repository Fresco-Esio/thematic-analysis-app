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
