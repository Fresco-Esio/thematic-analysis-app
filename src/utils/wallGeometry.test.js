import { cardRect, containment, assignmentAfterDrop, isContested } from './wallGeometry';

describe('cardRect', () => {
  test('centers the rect on the position with default card size', () => {
    expect(cardRect({ x: 100, y: 50 })).toEqual({ x: 12, y: 2, w: 176, h: 96 });
  });
});

describe('containment', () => {
  const region = { x: 0, y: 0, w: 440, h: 320 };

  test('fully inside', () => {
    const card = { x: 100, y: 100, w: 176, h: 96 };
    expect(containment(card, region)).toEqual({ fully: true, overlaps: true });
  });

  test('partial overlap', () => {
    const card = { x: 400, y: 100, w: 176, h: 96 }; // right edge pokes out
    expect(containment(card, region)).toEqual({ fully: false, overlaps: true });
  });

  test('disjoint', () => {
    const card = { x: 600, y: 600, w: 176, h: 96 };
    expect(containment(card, region)).toEqual({ fully: false, overlaps: false });
  });

  test('exact edges count as fully inside', () => {
    const card = { x: 0, y: 0, w: 440, h: 320 }; // same rect as region
    expect(containment(card, region)).toEqual({ fully: true, overlaps: true });
  });

  test('touching from outside is not an overlap', () => {
    const card = { x: 440, y: 0, w: 176, h: 96 }; // left edge exactly on region right edge
    expect(containment(card, region)).toEqual({ fully: false, overlaps: false });
  });
});

describe('assignmentAfterDrop', () => {
  const regions = [
    { id: 'region-t1', themeId: 't1', rect: { x: 0, y: 0, w: 440, h: 320 } },
    { id: 'region-t2', themeId: 't2', rect: { x: 400, y: 0, w: 440, h: 320 } }, // overlaps t1 on [400, 440)
  ];
  const card = (x, y) => ({ x, y, w: 176, h: 96 });

  test('drop fully inside one region → assign to that theme', () => {
    expect(assignmentAfterDrop(card(100, 100), [regions[0]], null)).toEqual({ assignTo: 't1' });
  });

  test('drop fully inside the current theme region → keep', () => {
    expect(assignmentAfterDrop(card(100, 100), [regions[0]], 't1')).toEqual({ keep: true });
  });

  test('drop on empty wall while assigned → unassign', () => {
    expect(assignmentAfterDrop(card(2000, 2000), regions, 't1')).toEqual({ unassign: true });
  });

  test('drop on empty wall while unassigned → keep', () => {
    expect(assignmentAfterDrop(card(2000, 2000), regions, null)).toEqual({ keep: true });
  });

  test('straddling two regions → keep (contested)', () => {
    // spans the overlap zone: intersects both, fully inside neither... actually
    // fully inside t1 AND overlapping t2 → not the single-clean-containment case
    expect(assignmentAfterDrop(card(420, 160), regions, null)).toEqual({ keep: true });
  });

  test('half-in-half-out of one region → keep (contested)', () => {
    // center (430,160): x-range [342,518] pokes past the region's right edge at 440
    expect(assignmentAfterDrop(card(430, 160), [regions[0]], null)).toEqual({ keep: true });
  });
});

describe('isContested', () => {
  const regions = [
    { id: 'region-t1', themeId: 't1', rect: { x: 0, y: 0, w: 440, h: 320 } },
    { id: 'region-t2', themeId: 't2', rect: { x: 400, y: 0, w: 440, h: 320 } },
  ];
  const card = (x, y) => ({ x, y, w: 176, h: 96 });

  test('fully inside exactly one region → not contested', () => {
    expect(isContested(card(100, 100), [regions[0]])).toBe(false);
  });

  test('overlapping two regions → contested', () => {
    expect(isContested(card(420, 160), regions)).toBe(true);
  });

  test('partially overlapping a single region → contested', () => {
    // center (430,160): x-range [342,518] pokes past the region's right edge at 440
    expect(isContested(card(430, 160), [regions[0]])).toBe(true);
  });

  test('on empty wall → not contested', () => {
    expect(isContested(card(2000, 2000), regions)).toBe(false);
  });
});
