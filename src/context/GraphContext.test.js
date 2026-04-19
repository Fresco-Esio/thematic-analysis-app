import { graphReducer, UNASSIGNED_COLOR } from './GraphContext';

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
