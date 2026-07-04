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
