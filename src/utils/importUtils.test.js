import { buildGraphFromRows } from './importUtils';
import { UNASSIGNED_COLOR } from '../context/GraphContext';

describe('buildGraphFromRows', () => {
  test('creates code nodes, reuses existing themes, and skips rows without code', () => {
    const existingThemes = [
      {
        id: 'theme-existing-coping',
        type: 'theme',
        label: 'Coping',
        color: '#123456',
        x: 500,
        y: 300,
      },
    ];

    const rows = [
      {
        source: 'Interview_01',
        quote: 'I use breathing to calm down.',
        code: 'Breathing routine',
        theme: 'Coping',
      },
      {
        source: 'Interview_02',
        quote: 'I avoid hard tasks.',
        code: 'Avoidance cycle',
        theme: '',
      },
      {
        source: 'Interview_03',
        quote: 'This row has no code',
        code: '',
        theme: 'Coping',
      },
    ];

    const result = buildGraphFromRows(rows, existingThemes);

    expect(result.codeNodes).toHaveLength(2);
    expect(result.themeNodes).toHaveLength(0);
    expect(result.edges).toHaveLength(1);

    const assignedNode = result.codeNodes.find((n) => n.label === 'Breathing routine');
    const unassignedNode = result.codeNodes.find((n) => n.label === 'Avoidance cycle');

    expect(assignedNode).toBeDefined();
    expect(assignedNode.primaryThemeId).toBe('theme-existing-coping');
    expect(assignedNode.color).toBe('#123456');

    expect(unassignedNode).toBeDefined();
    expect(unassignedNode.primaryThemeId).toBeNull();
    expect(unassignedNode.color).toBe(UNASSIGNED_COLOR);

    expect(result.summary).toMatchObject({
      codeCount: 2,
      themeCount: 0,
      assigned: 1,
      unassigned: 1,
      skipped: 1,
    });
  });

  test('creates new theme nodes from unique labels', () => {
    const rows = [
      { source: 'A', quote: 'q1', code: 'c1', theme: 'Theme Alpha' },
      { source: 'B', quote: 'q2', code: 'c2', theme: 'Theme Beta' },
      { source: 'C', quote: 'q3', code: 'c3', theme: 'Theme Alpha' },
    ];

    const result = buildGraphFromRows(rows, []);

    expect(result.themeNodes).toHaveLength(2);
    expect(result.codeNodes).toHaveLength(3);
    expect(result.edges).toHaveLength(3);

    const labels = result.themeNodes.map((n) => n.label).sort();
    expect(labels).toEqual(['Theme Alpha', 'Theme Beta']);

    const createdThemeIds = new Set(result.themeNodes.map((n) => n.id));
    result.codeNodes.forEach((node) => {
      expect(createdThemeIds.has(node.primaryThemeId)).toBe(true);
    });
  });
});
