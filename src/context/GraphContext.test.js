import { graphReducer, UNASSIGNED_COLOR, migrateV1ToV2 } from './GraphContext';

describe('graphReducer', () => {
  test('deleting a theme unassigns connected primary code nodes and removes attached edges', () => {
    const initialState = {
      nodes: [
        { id: 'theme-1', type: 'theme', label: 'Theme 1', color: '#111111', x: 100, y: 100 },
        { id: 'code-1', type: 'code', label: 'Code 1', primaryThemeId: 'theme-1', color: '#111111', x: 200, y: 200 },
        { id: 'code-2', type: 'code', label: 'Code 2', primaryThemeId: null, color: UNASSIGNED_COLOR, x: 260, y: 260 },
      ],
      edges: [
        { id: 'edge-1', source: 'code-1', target: 'theme-1' },
      ],
    };

    const nextState = graphReducer(initialState, { type: 'DELETE_NODE', id: 'theme-1' });

    expect(nextState.nodes).toHaveLength(2);
    expect(nextState.edges).toHaveLength(0);

    expect(nextState.nodes.find((node) => node.id === 'theme-1')).toBeUndefined();
    expect(nextState.nodes.find((node) => node.id === 'code-1')).toMatchObject({
      primaryThemeId: null,
      color: UNASSIGNED_COLOR,
    });
  });

  test('deleting a code node leaves unrelated nodes unchanged', () => {
    const initialState = {
      nodes: [
        { id: 'theme-1', type: 'theme', label: 'Theme 1', color: '#111111', x: 100, y: 100 },
        { id: 'code-1', type: 'code', label: 'Code 1', primaryThemeId: 'theme-1', color: '#111111', x: 200, y: 200 },
      ],
      edges: [
        { id: 'edge-1', source: 'code-1', target: 'theme-1' },
      ],
    };

    const nextState = graphReducer(initialState, { type: 'DELETE_NODE', id: 'code-1' });

    expect(nextState.nodes).toEqual([
      { id: 'theme-1', type: 'theme', label: 'Theme 1', color: '#111111', x: 100, y: 100 },
    ]);
    expect(nextState.edges).toEqual([]);
  });
});

describe('UPDATE_EDGE', () => {
  const baseState = {
    nodes: [],
    edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
  };

  test('updates relationType and label on the matching edge', () => {
    const next = graphReducer(baseState, {
      type: 'UPDATE_EDGE',
      id: 'e1',
      changes: { relationType: 'supports', label: 'supports' },
    });
    expect(next.edges[0]).toMatchObject({ id: 'e1', relationType: 'supports', label: 'supports' });
  });

  test('does not mutate other edges', () => {
    const state = {
      nodes: [],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
      ],
    };
    const next = graphReducer(state, {
      type: 'UPDATE_EDGE', id: 'e1', changes: { relationType: 'contradicts', label: 'contradicts' },
    });
    expect(next.edges[1]).toEqual({ id: 'e2', source: 'n2', target: 'n3' });
  });

  test('returns state unchanged for unknown id', () => {
    const next = graphReducer(baseState, {
      type: 'UPDATE_EDGE', id: 'nonexistent', changes: { relationType: 'supports' },
    });
    expect(next).toBe(baseState);
  });
});

const bulkBaseState = {
  nodes: [
    { id: 't1', type: 'theme', label: 'Theme 1', color: '#4f46e5', primaryThemeId: null },
    { id: 'c1', type: 'code',  label: 'Code 1',  color: '#6b7280', primaryThemeId: null },
    { id: 'c2', type: 'code',  label: 'Code 2',  color: '#6b7280', primaryThemeId: null },
  ],
  edges: [{ id: 'e1', source: 'c1', target: 't1' }],
};

test('DELETE_NODES removes multiple nodes and touching edges', () => {
  const next = graphReducer(bulkBaseState, { type: 'DELETE_NODES', ids: ['c1', 'c2'] });
  expect(next.nodes).toHaveLength(1);
  expect(next.nodes[0].id).toBe('t1');
  expect(next.edges).toHaveLength(0);
});

test('DELETE_NODES reverts primaryThemeId if theme is deleted', () => {
  const state = {
    nodes: [
      { id: 't1', type: 'theme', label: 'Theme 1', color: '#4f46e5' },
      { id: 'c1', type: 'code',  label: 'Code 1',  primaryThemeId: 't1', color: '#4f46e5' },
    ],
    edges: [],
  };
  const next = graphReducer(state, { type: 'DELETE_NODES', ids: ['t1'] });
  const c1 = next.nodes.find(n => n.id === 'c1');
  expect(c1.primaryThemeId).toBeNull();
  expect(c1.color).toBe('#6b7280');
});

test('BULK_ASSIGN_THEME assigns codes to a theme and adds edges', () => {
  const next = graphReducer(bulkBaseState, {
    type: 'BULK_ASSIGN_THEME',
    nodeIds: ['c1', 'c2'],
    targetId: 't1',
  });
  const c1 = next.nodes.find(n => n.id === 'c1');
  const c2 = next.nodes.find(n => n.id === 'c2');
  expect(c1.primaryThemeId).toBe('t1');
  expect(c2.primaryThemeId).toBe('t1');
  expect(c1.color).toBe('#4f46e5');
  expect(next.edges).toHaveLength(2); // e1 already existed for c1→t1, add c2→t1
});

test('BULK_ASSIGN_THEME via subtheme resolves to parent theme', () => {
  const state = {
    nodes: [
      { id: 't1', type: 'theme',    label: 'Theme 1',    color: '#4f46e5', primaryThemeId: null },
      { id: 's1', type: 'subtheme', label: 'Subtheme 1', color: '#4f46e5', primaryThemeId: 't1' },
      { id: 'c1', type: 'code',     label: 'Code 1',     color: '#6b7280', primaryThemeId: null },
    ],
    edges: [],
  };
  const next = graphReducer(state, {
    type: 'BULK_ASSIGN_THEME',
    nodeIds: ['c1'],
    targetId: 's1',
  });
  const c1 = next.nodes.find(n => n.id === 'c1');
  expect(c1.primaryThemeId).toBe('t1');
  expect(next.edges[0].target).toBe('s1');
});

test('DELETE_NODES with empty ids array is a no-op', () => {
  const next = graphReducer(bulkBaseState, { type: 'DELETE_NODES', ids: [] });
  expect(next.nodes).toHaveLength(bulkBaseState.nodes.length);
  expect(next.edges).toHaveLength(bulkBaseState.edges.length);
});

test('BULK_ASSIGN_THEME with non-existent targetId returns state unchanged', () => {
  const next = graphReducer(bulkBaseState, { type: 'BULK_ASSIGN_THEME', nodeIds: ['c1'], targetId: 'does-not-exist' });
  expect(next).toBe(bulkBaseState); // referential equality — no new object
});

test('UPDATE_NODE theme color change cascades to assigned codes and subthemes in one action', () => {
  const state = {
    nodes: [
      { id: 't1', type: 'theme',    label: 'Theme 1',    color: '#4f46e5' },
      { id: 's1', type: 'subtheme', label: 'Subtheme 1', color: '#4f46e5', primaryThemeId: 't1' },
      { id: 'c1', type: 'code',     label: 'Code 1',     color: '#4f46e5', primaryThemeId: 't1' },
      { id: 'c2', type: 'code',     label: 'Code 2',     color: '#6b7280', primaryThemeId: null },
    ],
    edges: [],
  };
  const next = graphReducer(state, { type: 'UPDATE_NODE', id: 't1', changes: { color: '#059669' } });
  expect(next.nodes.find(n => n.id === 't1').color).toBe('#059669');
  expect(next.nodes.find(n => n.id === 's1').color).toBe('#059669');
  expect(next.nodes.find(n => n.id === 'c1').color).toBe('#059669');
  expect(next.nodes.find(n => n.id === 'c2').color).toBe('#6b7280'); // unassigned untouched
});

test('UPDATE_NODE without color change does not cascade', () => {
  const state = {
    nodes: [
      { id: 't1', type: 'theme', label: 'Theme 1', color: '#4f46e5' },
      { id: 'c1', type: 'code',  label: 'Code 1',  color: '#4f46e5', primaryThemeId: 't1' },
    ],
    edges: [],
  };
  const next = graphReducer(state, { type: 'UPDATE_NODE', id: 't1', changes: { label: 'Renamed' } });
  expect(next.nodes.find(n => n.id === 'c1')).toEqual(state.nodes[1]);
});

test('ADD_EDGE to a subtheme resolves primaryThemeId to the parent theme', () => {
  const state = {
    nodes: [
      { id: 't1', type: 'theme',    label: 'Theme 1',    color: '#4f46e5' },
      { id: 's1', type: 'subtheme', label: 'Subtheme 1', color: '#4f46e5', primaryThemeId: 't1' },
      { id: 'c1', type: 'code',     label: 'Code 1',     color: '#6b7280', primaryThemeId: null },
    ],
    edges: [],
  };
  const next = graphReducer(state, { type: 'ADD_EDGE', edge: { id: 'e1', source: 'c1', target: 's1' } });
  const c1 = next.nodes.find(n => n.id === 'c1');
  expect(c1.primaryThemeId).toBe('t1');
  expect(c1.color).toBe('#4f46e5');
  expect(next.edges).toHaveLength(1);
  expect(next.edges[0].target).toBe('s1');
});

test('ADD_EDGE to a theme still assigns primaryThemeId directly', () => {
  const state = {
    nodes: [
      { id: 't1', type: 'theme', label: 'Theme 1', color: '#4f46e5' },
      { id: 'c1', type: 'code',  label: 'Code 1',  color: '#6b7280', primaryThemeId: null },
    ],
    edges: [],
  };
  const next = graphReducer(state, { type: 'ADD_EDGE', edge: { id: 'e1', source: 'c1', target: 't1' } });
  const c1 = next.nodes.find(n => n.id === 'c1');
  expect(c1.primaryThemeId).toBe('t1');
  expect(c1.color).toBe('#4f46e5');
});

describe('v1 → v2 migration', () => {
  test('seeds wallPosition from physics x/y and a region per theme', () => {
    const v1 = {
      nodes: [
        { id: 't1', type: 'theme', label: 'Theme 1', color: '#4f46e5', x: 500, y: 300 },
        { id: 'c1', type: 'code', label: 'Code 1', quote: 'q', source: 's', primaryThemeId: 't1', color: '#4f46e5', x: 620, y: 340 },
      ],
      edges: [{ id: 'e1', source: 'c1', target: 't1' }],
    };
    const v2 = migrateV1ToV2(v1);
    expect(v2.nodes.find(n => n.id === 'c1').wallPosition).toEqual({ x: 620, y: 340 });
    expect(v2.regions).toHaveLength(1);
    expect(v2.regions[0]).toMatchObject({ themeId: 't1' });
    expect(v2.regions[0].rect.w).toBeGreaterThan(0);
    expect(v2.edges).toEqual(v1.edges); // untouched
  });

  test('nodes without x/y get no wallPosition (Wall places them in the margin)', () => {
    const v2 = migrateV1ToV2({ nodes: [{ id: 'c1', type: 'code', label: 'C' }], edges: [] });
    expect(v2.nodes[0].wallPosition).toBeUndefined();
  });
});

describe('regions in reducer state', () => {
  const regionState = {
    nodes: [
      { id: 't1', type: 'theme', label: 'T', color: '#4f46e5', x: 0, y: 0 },
      { id: 'c1', type: 'code', label: 'C', primaryThemeId: 't1', color: '#4f46e5', x: 0, y: 0 },
    ],
    edges: [{ id: 'e1', source: 'c1', target: 't1' }],
    regions: [{ id: 'region-t1', themeId: 't1', rect: { x: -220, y: -160, w: 440, h: 320 } }],
  };

  test('DELETE_NODE preserves regions of other themes and removes the deleted theme region', () => {
    const next = graphReducer(regionState, { type: 'DELETE_NODE', id: 't1' });
    expect(next.regions).toEqual([]); // cascade
  });

  test('DELETE_NODE of a code leaves regions untouched', () => {
    const next = graphReducer(regionState, { type: 'DELETE_NODE', id: 'c1' });
    expect(next.regions).toEqual(regionState.regions);
  });

  test('UPDATE_REGION changes rect; unknown id is a no-op', () => {
    const next = graphReducer(regionState, {
      type: 'UPDATE_REGION', id: 'region-t1', changes: { rect: { x: 0, y: 0, w: 100, h: 100 } },
    });
    expect(next.regions[0].rect).toEqual({ x: 0, y: 0, w: 100, h: 100 });
    expect(graphReducer(regionState, { type: 'UPDATE_REGION', id: 'nope', changes: {} })).toBe(regionState);
  });

  test('UNASSIGN_CODE clears primaryThemeId, reverts color, and removes the theme edge atomically', () => {
    const next = graphReducer(regionState, { type: 'UNASSIGN_CODE', id: 'c1' });
    const c1 = next.nodes.find(n => n.id === 'c1');
    expect(c1.primaryThemeId).toBeNull();
    expect(c1.color).toBe(UNASSIGNED_COLOR);
    expect(next.edges).toEqual([]);
  });

  test('CLEAR resets regions too', () => {
    expect(graphReducer(regionState, { type: 'CLEAR' }).regions).toEqual([]);
  });
});
