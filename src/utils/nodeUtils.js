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
 * @returns {{ diameter: number, fontSize: number }}
 */
export function getNodeSize(node) {
  const charCount = (node.label || '').length;

  if (node.type === 'theme') {
    const fontSize = Math.max(16, Math.min(26, 16 + Math.floor(charCount / 6)));
    const diameter = Math.max(120, Math.round(fontSize * charCount * 0.55 + 48));
    return { diameter, fontSize };
  } else {
    // code node
    const fontSize = Math.max(16, Math.min(22, 16 + Math.floor(charCount / 8)));
    const diameter = Math.max(100, Math.round(fontSize * charCount * 0.52 + 40));
    return { diameter, fontSize };
  }
}

/**
 * Convenience: returns the radius (half of diameter) for a node.
 * Used by Canvas.js for fitToView bounding box calculation.
 */
export function getNodeRadius(node) {
  return getNodeSize(node).diameter / 2;
}
