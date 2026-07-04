/**
 * sankeyTransform.js
 * ──────────────────────────────────────────────────────────────────────────
 * Pure transform: graph state → d3-sankey {nodes, links} input.
 * Columns: sources → codes → (subthemes, optional) → themes / Unassigned.
 *
 * Sources are not graph nodes — the source column derives from distinct
 * trimmed `code.source` strings; blank sources bucket into "No source".
 *
 * Every code contributes value-1 links along its whole path, so ribbon
 * thickness aggregates code counts per path (d3-sankey stacks parallel
 * links), and each link carries the ids needed for path-level hover
 * highlighting in SankeyView:
 *   codeId      — the code this link's unit of flow passes through
 *   themeKey    — destination theme id, or UNASSIGNED_ID
 *   sourceLabel — origin source-bucket label
 *   subId       — routing subtheme id, or null
 *
 * warnings: Set<themeId> of themes grounded in a single source bucket —
 * the "one loud interview" detector.
 *
 * NO d3 imports here: d3 v7 is ESM-only and CRA's jest doesn't transform
 * node_modules, so this module stays dependency-free to stay unit-testable.
 */

import { UNASSIGNED_COLOR } from '../context/GraphContext';

export const UNASSIGNED_ID = 'sankey:unassigned';
export const NO_SOURCE_ID = 'sankey:no-source';
export const NO_SOURCE_LABEL = 'No source';

export function buildSankeyData(nodes, edges, { includeSubthemes = false } = {}) {
  const codes = nodes.filter(n => n.type === 'code');
  if (codes.length === 0) {
    return { nodes: [], links: [], warnings: new Set(), isEmpty: true };
  }

  const themesById = new Map(nodes.filter(n => n.type === 'theme').map(n => [n.id, n]));
  const subthemesById = new Map(nodes.filter(n => n.type === 'subtheme').map(n => [n.id, n]));
  const codesById = new Map(codes.map(n => [n.id, n]));

  // code id → routing subtheme (first edge to a subtheme of the code's own theme)
  const subthemeForCode = new Map();
  if (includeSubthemes) {
    for (const e of edges) {
      if (subthemeForCode.has(e.source)) continue;
      const sub = subthemesById.get(e.target);
      const c = codesById.get(e.source);
      if (sub && c && c.primaryThemeId && sub.primaryThemeId === c.primaryThemeId) {
        subthemeForCode.set(e.source, sub);
      }
    }
  }

  const outNodes = [];
  const seen = new Set();
  const addNode = (n) => { if (!seen.has(n.id)) { seen.add(n.id); outNodes.push(n); } };
  const links = [];
  const themeSourceBuckets = new Map(); // themeId → Set<sourceLabel>

  for (const c of codes) {
    const sourceLabel = (c.source || '').trim() || NO_SOURCE_LABEL;
    const sourceId = sourceLabel === NO_SOURCE_LABEL ? NO_SOURCE_ID : `sankey:src:${sourceLabel}`;
    addNode({ id: sourceId, label: sourceLabel, kind: 'source', color: '#0f0d0a' });
    addNode({ id: c.id, label: c.label, kind: 'code', color: c.color, ref: c });

    // dangling primaryThemeId (theme deleted out from under it) degrades to Unassigned
    const t = c.primaryThemeId ? themesById.get(c.primaryThemeId) : null;
    const sub = t ? subthemeForCode.get(c.id) : null;
    const common = {
      value: 1,
      codeId: c.id,
      themeKey: t ? t.id : UNASSIGNED_ID,
      sourceLabel,
      subId: sub ? sub.id : null,
    };

    links.push({ source: sourceId, target: c.id, color: t ? t.color : UNASSIGNED_COLOR, ...common });

    if (t) {
      addNode({ id: t.id, label: t.label, kind: 'theme', color: t.color, ref: t });
      if (!themeSourceBuckets.has(t.id)) themeSourceBuckets.set(t.id, new Set());
      themeSourceBuckets.get(t.id).add(sourceLabel);
      if (sub) {
        addNode({ id: sub.id, label: sub.label, kind: 'subtheme', color: sub.color, ref: sub });
        links.push({ source: c.id, target: sub.id, color: t.color, ...common });
        links.push({ source: sub.id, target: t.id, color: t.color, ...common });
      } else {
        links.push({ source: c.id, target: t.id, color: t.color, ...common });
      }
    } else {
      addNode({ id: UNASSIGNED_ID, label: 'Unassigned', kind: 'unassigned', color: UNASSIGNED_COLOR });
      links.push({ source: c.id, target: UNASSIGNED_ID, color: UNASSIGNED_COLOR, ...common });
    }
  }

  const warnings = new Set();
  for (const [themeId, buckets] of themeSourceBuckets) {
    if (buckets.size === 1) warnings.add(themeId);
  }

  return { nodes: outNodes, links, warnings, isEmpty: false };
}
