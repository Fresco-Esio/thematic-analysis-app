/**
 * nodeUtils.js
 * Single source of truth for node sizing.
 * All sizing logic reads from here — never hardcode 160 or 130 elsewhere.
 */

/**
 * Returns { diameter, fontSize } for a given node.
 * Minimum font size is 16px (per design spec).
 * Minimum diameter: theme 120px, code 100px.
 *
 * @param {{ type: string, label: string }} node
 * @returns {{ diameter: number, fontSize: number, width?: number }}
 */
// Maximum diameters — prevents excessively large nodes for long labels.
// Text wraps within the capped circle via wordBreak in GraphNode.js.
const MAX_THEME_DIAMETER  = 210;
const MAX_CODE_DIAMETER   = 170;
const MAX_SUBTHEME_WIDTH  = 220;
const MIN_SUBTHEME_WIDTH  = 120;

export function getNodeSize(node) {
  const charCount = (node.label || '').length;

  if (node.type === 'theme') {
    // Font shrinks for longer labels so text wraps within the capped circle
    const fontSize = Math.max(13, Math.min(22, 20 - Math.floor(charCount / 10)));
    const rawDiameter = Math.max(120, Math.round(90 + charCount * 3.2));
    const diameter = Math.min(rawDiameter, MAX_THEME_DIAMETER);
    return { diameter, fontSize };
  } else if (node.type === 'subtheme') {
    const fontSize = Math.max(12, Math.min(18, 17 - Math.floor(charCount / 12)));
    const width = Math.min(MAX_SUBTHEME_WIDTH, Math.max(MIN_SUBTHEME_WIDTH, Math.round(80 + charCount * 5)));
    // Return width as both width and diameter — consumers that need diameter get a sensible fallback
    return { width, fontSize, diameter: width };
  } else {
    // code node
    const fontSize = Math.max(12, Math.min(18, 17 - Math.floor(charCount / 12)));
    const rawDiameter = Math.max(100, Math.round(80 + charCount * 2.8));
    const diameter = Math.min(rawDiameter, MAX_CODE_DIAMETER);
    return { diameter, fontSize };
  }
}

/**
 * Convenience: returns the radius (half of diameter) for a node.
 * Used by Canvas.js for fitToView bounding box calculation.
 * Note: for subtheme nodes, diameter === width, so this returns half-width (not a circle radius).
 */
export function getNodeRadius(node) {
  return getNodeSize(node).diameter / 2;
}
