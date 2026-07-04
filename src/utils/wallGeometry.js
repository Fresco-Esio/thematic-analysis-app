/**
 * wallGeometry.js
 * ──────────────────────────────────────────────────────────────────────────
 * Pure geometry helpers for the Research Wall. All rects are world-space
 * `{ x, y, w, h }` (x/y = top-left corner); card positions are centers.
 */

/** Axis-aligned rect of a card centered at `pos` */
export function cardRect(pos, w = 176, h = 96) {
  return { x: pos.x - w / 2, y: pos.y - h / 2, w, h };
}

/**
 * How a card rect relates to a region rect.
 * `fully`    — card is entirely inside the region (edges touching count as in)
 * `overlaps` — card and region intersect at all
 */
export function containment(card, region) {
  const fully = card.x >= region.x && card.y >= region.y &&
    card.x + card.w <= region.x + region.w && card.y + card.h <= region.y + region.h;
  const overlaps = card.x < region.x + region.w && card.x + card.w > region.x &&
    card.y < region.y + region.h && card.y + card.h > region.y;
  return { fully, overlaps };
}

/**
 * Decide assignment after a card drop.
 * Returns { assignTo: themeId } | { unassign: true } | { keep: true }.
 * Only an unambiguous placement changes assignment: fully inside exactly one
 * region assigns; fully outside all regions unassigns; anything partial or
 * multi-overlap keeps the current theme (and renders as contested).
 */
export function assignmentAfterDrop(card, regions, currentThemeId) {
  const fully = regions.filter(r => containment(card, r.rect).fully);
  const overlapping = regions.filter(r => containment(card, r.rect).overlaps);
  if (fully.length === 1 && overlapping.length === 1) {
    return fully[0].themeId === currentThemeId ? { keep: true } : { assignTo: fully[0].themeId };
  }
  if (overlapping.length === 0) {
    return currentThemeId ? { unassign: true } : { keep: true };
  }
  return { keep: true }; // partial or multi-overlap → contested, keep assignment
}

/** A card is contested when its placement is ambiguous between regions */
export function isContested(card, regions) {
  const overlapping = regions.filter(r => containment(card, r.rect).overlaps);
  const fullyIn = regions.filter(r => containment(card, r.rect).fully);
  return overlapping.length >= 2 || (overlapping.length === 1 && fullyIn.length === 0);
}

/** Approximate footprint of a region's label plate (top-left corner) */
const PLATE = { w: 150, h: 28 };

/**
 * Where a string should attach to a region: the point on the region's border
 * nearest to `from`, nudged off the label plate zone (top-left corner) so
 * strings never overlap the theme name.
 */
export function stringAnchorOnRegion(rect, from) {
  const right = rect.x + rect.w;
  const bottom = rect.y + rect.h;

  // Nearest point on the perimeter
  let x = Math.min(Math.max(from.x, rect.x), right);
  let y = Math.min(Math.max(from.y, rect.y), bottom);
  const inside = from.x > rect.x && from.x < right && from.y > rect.y && from.y < bottom;
  if (inside) {
    // Push to the closest edge
    const dLeft = from.x - rect.x, dRight = right - from.x;
    const dTop = from.y - rect.y, dBottom = bottom - from.y;
    const m = Math.min(dLeft, dRight, dTop, dBottom);
    if (m === dLeft) x = rect.x;
    else if (m === dRight) x = right;
    else if (m === dTop) y = rect.y;
    else y = bottom;
  }

  // Steer clear of the label plate: top edge → move right of the plate;
  // left edge → move below it
  if (y === rect.y && x < rect.x + PLATE.w) x = Math.min(rect.x + PLATE.w, right);
  if (x === rect.x && y < rect.y + PLATE.h) y = Math.min(rect.y + PLATE.h, bottom);

  return { x, y };
}

/**
 * Group cards into piles by center proximity (single-link: a–b and b–c within
 * threshold chains all three, even if a–c is not). Piles are derived at
 * render time — never stored. Returns arrays of card ids.
 */
export function clusterPiles(cards, threshold = 28) {
  const n = cards.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.hypot(cards[i].x - cards[j].x, cards[i].y - cards[j].y) <= threshold) union(i, j);
    }
  }
  const groups = new Map();
  cards.forEach((c, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(c.id);
  });
  return [...groups.values()];
}
