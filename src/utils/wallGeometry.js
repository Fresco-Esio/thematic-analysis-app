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

/**
 * Where a string should attach to a region: cast a ray from the region's
 * center toward `from` and stop at the border. Unlike a nearest-edge rule,
 * this moves CONTINUOUSLY around the perimeter as the card moves — no
 * snapping between edges at corner crossings. (The label plate stays legible
 * via z-order: plates render above the string layer.)
 */
export function stringAnchorOnRegion(rect, from) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  let dx = from.x - cx;
  let dy = from.y - cy;
  if (dx === 0 && dy === 0) dy = -1; // degenerate: aim at the top edge
  // Scale the direction vector until it first hits the border
  const sx = dx !== 0 ? (rect.w / 2) / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? (rect.h / 2) / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
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

// ── Import seeding ───────────────────────────────────────────────────────────

const CARD_W = 176, CARD_H = 96;          // must match cardRect() defaults
const CELL_W = 192, CELL_H = 112;         // card + gutter
const REGION_PAD = 24;                    // inner padding on all sides
const LABEL_HEADROOM = 48;                // clearance under the region label plate
const REGION_GUTTER = 80;                 // spacing between packed regions
const ROW_WRAP_W = 2400;                  // wrap region-packing rows at this width
const MIN_REGION_W = 440, MIN_REGION_H = 320; // matches Add Theme / v1 migration

/**
 * Seed Wall territories for imported themes: one non-overlapping region per
 * theme that lacks one (sized to its card count, packed into rows below any
 * existing regions), plus grid wallPositions for every themed code — always
 * FULLY inside its region so assignmentAfterDrop keeps the assignment.
 * Themes that already have a region keep it; their new codes grid into the
 * existing rect, clamped inside (overflow stacks — clusterPiles handles it).
 *
 * @param {Array}  themes          theme nodes to place codes for
 * @param {Map}    codesByThemeId  themeId → code nodes (import order)
 * @param {Array}  existingRegions current state.regions
 * @returns {{ regions: Array, wallPositions: Map<codeId, {x,y}> }}
 */
export function seedWallLayout(themes, codesByThemeId, existingRegions = []) {
  const regionByTheme = new Map(existingRegions.map(r => [r.themeId, r]));
  const newRegions = [];
  const wallPositions = new Map();

  // New regions pack below whatever is already on the wall
  const originX = 80;
  const originY = existingRegions.length
    ? Math.max(...existingRegions.map(r => r.rect.y + r.rect.h)) + REGION_GUTTER
    : 80;

  // 1. Size + row-pack a region per theme lacking one
  let cx = originX, cy = originY, rowH = 0;
  for (const t of themes) {
    if (regionByTheme.has(t.id)) continue;
    const n = (codesByThemeId.get(t.id) || []).length;
    const cols = Math.max(2, Math.ceil(Math.sqrt(n * 1.5)));
    const rows = Math.max(1, Math.ceil(n / cols));
    const w = Math.max(MIN_REGION_W, cols * CELL_W + REGION_PAD * 2);
    const h = Math.max(MIN_REGION_H, rows * CELL_H + REGION_PAD * 2 + LABEL_HEADROOM);
    if (cx > originX && cx + w > ROW_WRAP_W) {
      cx = originX;
      cy += rowH + REGION_GUTTER;
      rowH = 0;
    }
    const region = { id: `region-${t.id}`, themeId: t.id, rect: { x: cx, y: cy, w, h } };
    newRegions.push(region);
    regionByTheme.set(t.id, region);
    cx += w + REGION_GUTTER;
    rowH = Math.max(rowH, h);
  }

  // 2. Grid card centers inside each theme's region (new or existing)
  for (const t of themes) {
    const codes = codesByThemeId.get(t.id) || [];
    const region = regionByTheme.get(t.id);
    if (!codes.length || !region) continue;
    const { rect } = region;
    const firstX = rect.x + REGION_PAD + CARD_W / 2;
    const firstY = rect.y + LABEL_HEADROOM + REGION_PAD + CARD_H / 2;
    const maxX = rect.x + rect.w - REGION_PAD - CARD_W / 2;
    const maxY = rect.y + rect.h - REGION_PAD - CARD_H / 2;
    const fitCols = Math.max(1, Math.floor((rect.w - REGION_PAD * 2) / CELL_W));
    codes.forEach((c, i) => {
      const col = i % fitCols;
      const row = Math.floor(i / fitCols);
      wallPositions.set(c.id, {
        x: Math.min(firstX + col * CELL_W, maxX),
        y: Math.min(firstY + row * CELL_H, maxY),
      });
    });
  }

  return { regions: newRegions, wallPositions };
}
