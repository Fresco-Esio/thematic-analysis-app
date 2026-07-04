import { cardRect, containment } from './wallGeometry';

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
