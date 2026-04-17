/**
 * edgeTypes.js
 * ─────────────────────────────────────────────────────────────────────────
 * Preset relationship types for edges between code and theme nodes.
 * Each type has a display label and an SVG strokeDasharray pattern.
 * Solid lines (supports) use an empty string — browser default is solid.
 */

export const EDGE_TYPES = {
  supports:       { label: 'supports',       dashArray: '' },
  elaborates:     { label: 'elaborates',     dashArray: '10,5' },
  contradicts:    { label: 'contradicts',    dashArray: '5,5' },
  exemplifies:    { label: 'exemplifies',    dashArray: '2,6' },
  contextualises: { label: 'contextualises', dashArray: '16,5' },
  questions:      { label: 'questions',      dashArray: '5,10' },
};

/** Returns the strokeDasharray string for a given relationType key, or '' for solid. */
export function getEdgeDashArray(relationType) {
  if (!relationType || !EDGE_TYPES[relationType]) return '';
  return EDGE_TYPES[relationType].dashArray;
}

/** Returns stroke width: 3.5px for typed edges, 2px for unlabeled. */
export function getEdgeStrokeWidth(relationType) {
  return relationType && EDGE_TYPES[relationType] ? 3.5 : 2;
}
