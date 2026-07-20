/**
 * outlineTransform.js
 * ──────────────────────────────────────────────────────────────────────────
 * Pure transform: graph state → Outline view structure.
 *
 *   buildOutline(nodes, edges) → {
 *     themes: [{ theme, subthemes: [{ subtheme, codes }], looseCodes,
 *                codeCount, sourceCounts: Map<label, n> }],   // codeCount desc
 *     unassigned: [codes],           // no theme, or dangling primaryThemeId
 *     sources: [label],              // distinct, alphabetical, "No source" last
 *     warnings: Set<themeId>,        // single-source themes (≥2 sources exist)
 *     isEmpty,
 *   }
 *
 * Subtheme routing matches the former Sankey rule: a code renders under the
 * first edge-linked subtheme belonging to the code's own theme.
 *
 * NO React/d3 imports — stays unit-testable under CRA jest.
 */

export const NO_SOURCE_LABEL = 'No source';

export function buildOutline(nodes, edges) {
  const codes = nodes.filter(n => n.type === 'code');
  if (codes.length === 0) {
    return { themes: [], unassigned: [], sources: [], warnings: new Set(), isEmpty: true };
  }

  const themeNodes = nodes.filter(n => n.type === 'theme');
  const themeIds = new Set(themeNodes.map(t => t.id));
  const subthemesById = new Map(nodes.filter(n => n.type === 'subtheme').map(n => [n.id, n]));
  const codesById = new Map(codes.map(n => [n.id, n]));

  // code id → routing subtheme (first edge to a subtheme of the code's own theme)
  const subthemeForCode = new Map();
  for (const e of edges) {
    if (subthemeForCode.has(e.source)) continue;
    const s = subthemesById.get(e.target);
    const c = codesById.get(e.source);
    if (s && c && c.primaryThemeId && s.primaryThemeId === c.primaryThemeId) {
      subthemeForCode.set(e.source, s);
    }
  }

  const sourceOf = (c) => (c.source || '').trim() || NO_SOURCE_LABEL;

  const sourceSet = new Set(codes.map(sourceOf));
  const sources = [...sourceSet]
    .filter(s => s !== NO_SOURCE_LABEL)
    .sort((a, b) => a.localeCompare(b));
  if (sourceSet.has(NO_SOURCE_LABEL)) sources.push(NO_SOURCE_LABEL);

  const themes = themeNodes.map(t => {
    const themeCodes = codes.filter(c => c.primaryThemeId === t.id);
    const subMap = new Map(); // subthemeId → { subtheme, codes }
    const looseCodes = [];
    const sourceCounts = new Map();
    for (const c of themeCodes) {
      const s = sourceOf(c);
      sourceCounts.set(s, (sourceCounts.get(s) || 0) + 1);
      const routed = subthemeForCode.get(c.id);
      if (routed) {
        if (!subMap.has(routed.id)) subMap.set(routed.id, { subtheme: routed, codes: [] });
        subMap.get(routed.id).codes.push(c);
      } else {
        looseCodes.push(c);
      }
    }
    return { theme: t, subthemes: [...subMap.values()], looseCodes, codeCount: themeCodes.length, sourceCounts };
  });
  themes.sort((a, b) => b.codeCount - a.codeCount);

  const unassigned = codes.filter(c => !c.primaryThemeId || !themeIds.has(c.primaryThemeId));

  const warnings = new Set();
  if (sources.length >= 2) {
    for (const t of themes) {
      if (t.codeCount > 0 && t.sourceCounts.size === 1) warnings.add(t.theme.id);
    }
  }

  return { themes, unassigned, sources, warnings, isEmpty: false };
}
