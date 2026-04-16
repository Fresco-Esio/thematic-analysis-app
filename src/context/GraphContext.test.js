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
