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
