/**
 * SankeyView.js
 * ──────────────────────────────────────────────────────────────────────────
 * Sankey of Evidence — read-mostly lens on the graph:
 *   sources → codes → (subthemes, optional) → themes / Unassigned.
 *
 * The figure renders inside a fixed 16:10 frame (FIG_W × FIG_H viewBox)
 * centered in the panel, so PNG/PDF export always yields a figure-friendly
 * aspect ratio. The frame div carries id="canvas-export-target" — the shared
 * export id (Canvas / WallView / SankeyView are mutually exclusive mounts).
 *
 * PROPS:
 *   onEditCode {fn(nodeId)} — open CodeEditModal (the only edit affordance)
 *   onImport   {fn}         — open ImportModal from the empty state
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { sankey, sankeyLinkHorizontal, sankeyJustify } from 'd3-sankey';
import { useGraph } from '../../context/GraphContext';
import { buildSankeyData } from '../../utils/sankeyTransform';
import QuoteTooltip from '../QuoteTooltip';

const FIG_W = 1280;
const FIG_H = 800; // 16:10 — fixed figure aspect ratio for export
const MARGIN = { top: 64, right: 210, bottom: 28, left: 210 };
const RIBBON_OPACITY = 0.8; // design §5: theme palette at ~80% opacity

/** Does this link belong to the hovered/isolated selection? */
function linkMatches(l, probe) {
  if (!probe) return false;
  if (probe.codeId) return l.codeId === probe.codeId;
  if (probe.subId) return l.subId === probe.subId;
  if (probe.themeKey) return l.themeKey === probe.themeKey;
  if (probe.sourceLabel) return l.sourceLabel === probe.sourceLabel;
  return false;
}

/** What a hover on this node should highlight */
function hoverProbeFor(n) {
  switch (n.kind) {
    case 'code':       return { codeId: n.id };
    case 'subtheme':   return { subId: n.id };
    case 'theme':      return { themeKey: n.id };
    case 'unassigned': return { themeKey: n.id }; // links into the sink carry themeKey = UNASSIGNED_ID
    case 'source':     return { sourceLabel: n.label };
    default:           return null;
  }
}

export default function SankeyView({ onEditCode, onImport }) {
  const { nodes, edges } = useGraph();
  const wrapRef = useRef(null);
  const [frame, setFrame] = useState({ w: 960, h: 600 });
  const [hover, setHover] = useState(null);              // probe object or null
  const [isolatedThemeId, setIsolatedThemeId] = useState(null);
  const [tooltip, setTooltip] = useState(null);          // { x, y, node } or null
  const [includeSubthemes, setIncludeSubthemes] = useState(false);
  const hasSubthemes = nodes.some(n => n.type === 'subtheme');

  // Fit the fixed-ratio figure inside the available panel space
  useEffect(() => {
    function measure() {
      const el = wrapRef.current;
      if (!el) return;
      const availW = el.clientWidth - 48;
      const availH = el.clientHeight - 48;
      const w = Math.max(320, Math.min(availW, availH * (FIG_W / FIG_H)));
      setFrame({ w, h: w * (FIG_H / FIG_W) });
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Escape exits flow isolation
  useEffect(() => {
    if (!isolatedThemeId) return;
    function onKey(e) { if (e.key === 'Escape') setIsolatedThemeId(null); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isolatedThemeId]);

  const data = useMemo(
    () => buildSankeyData(nodes, edges, { includeSubthemes }),
    [nodes, edges, includeSubthemes]
  );

  const layout = useMemo(() => {
    if (data.isEmpty) return null;
    const generator = sankey()
      .nodeId(d => d.id)
      .nodeWidth(18)
      .nodePadding(14)
      .nodeAlign(sankeyJustify)
      .extent([[MARGIN.left, MARGIN.top], [FIG_W - MARGIN.right, FIG_H - MARGIN.bottom]]);
    // d3-sankey mutates its input — feed it copies, keep `data` pure
    return generator({
      nodes: data.nodes.map(n => ({ ...n })),
      links: data.links.map(l => ({ ...l })),
    });
  }, [data]);

  // Unique node x-positions, sorted → header placement per rendered column
  const columns = useMemo(() => {
    if (!layout) return [];
    return [...new Set(layout.nodes.map(n => Math.round(n.x0)))].sort((a, b) => a - b);
  }, [layout]);
  // 4 rendered columns can only occur when subtheme routing is active; with the
  // toggle off (or on but with no routed codes) the transform emits no subtheme
  // nodes and the layout has 3 columns.
  const headerLabels = columns.length === 4
    ? ['SOURCES', 'CODES', 'SUBTHEMES', 'THEMES']
    : ['SOURCES', 'CODES', 'THEMES'];

  const litNodeIds = useMemo(() => {
    const probe = hover ?? (isolatedThemeId ? { themeKey: isolatedThemeId } : null);
    if (!layout || !probe) return null;
    const lit = new Set();
    for (const l of layout.links) {
      if (linkMatches(l, probe)) { lit.add(l.source.id); lit.add(l.target.id); }
    }
    return lit;
  }, [layout, hover, isolatedThemeId]);

  function linkOpacity(l) {
    if (isolatedThemeId && l.themeKey !== isolatedThemeId) return 0.06;
    if (hover) return linkMatches(l, hover) ? 0.95 : 0.12;
    return RIBBON_OPACITY;
  }

  function nodeOpacity(n) {
    if (!litNodeIds) return 1;
    return litNodeIds.has(n.id) ? 1 : 0.25;
  }

  function handleNodeClick(n) {
    if (n.kind === 'theme') setIsolatedThemeId(prev => (prev === n.id ? null : n.id));
    else if (n.kind === 'code') onEditCode?.(n.id);
  }

  function handleCodeMouseMove(n, e) {
    const rect = wrapRef.current.getBoundingClientRect();
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, node: n.ref });
  }

  return (
    <div
      ref={wrapRef}
      className="flex-1 relative flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: 'var(--bg-canvas)' }}
    >
      {data.isEmpty ? (
        <div className="text-center max-w-md p-8 border-2 border-[#0f0d0a] bg-white shadow-[8px_8px_0_#0f0d0a]">
          <p className="text-xl font-bold mb-3">Nothing to chart yet</p>
          <p className="text-base mb-5" style={{ color: '#6b6560' }}>
            The Sankey shows how sources flow through codes into themes. Import
            a CSV/Excel of coded excerpts, or add codes and connect them to
            themes in the Graph view.
          </p>
          <button
            onClick={onImport}
            className="px-4 py-2 font-bold text-base cursor-pointer border-2 bg-[#dc2626] text-white border-[#dc2626] hover:bg-[#b91c1c] shadow-[3px_3px_0_#0f0d0a]"
          >
            ⬆ Import Data
          </button>
        </div>
      ) : (
        <div
          id="canvas-export-target"
          className="relative bg-white border-2 border-[#0f0d0a] shadow-[8px_8px_0_#0f0d0a]"
          style={{ width: frame.w, height: frame.h }}
        >
          <svg width="100%" height="100%" viewBox={`0 0 ${FIG_W} ${FIG_H}`} preserveAspectRatio="xMidYMid meet">
            {/* column headers */}
            {columns.map((x, i) => headerLabels[i] && (
              <text
                key={x}
                x={x + 9}
                y={34}
                textAnchor="middle"
                fontSize="15"
                fontWeight="700"
                letterSpacing="0.1em"
                fill="#6b6560"
              >
                {headerLabels[i]}
              </text>
            ))}

            {/* ribbons */}
            <g fill="none">
              {layout.links.map((l, i) => (
                <path
                  key={`${l.codeId}-${l.source.id}-${l.target.id}-${i}`}
                  d={sankeyLinkHorizontal()(l)}
                  stroke={l.color}
                  strokeWidth={Math.max(1, l.width)}
                  strokeOpacity={linkOpacity(l)}
                  role="img"
                  aria-label={`${l.source.label} flows into ${l.target.label}`}
                  style={{ transition: 'stroke-opacity 0.15s' }}
                />
              ))}
            </g>

            {/* node bars + labels */}
            {layout.nodes.map(n => {
              const clickable = n.kind === 'theme' || n.kind === 'code';
              const warn = n.kind === 'theme' && data.warnings.has(n.id);
              const labelOnRight = n.x0 < FIG_W / 2;
              return (
                <g
                  key={n.id}
                  opacity={nodeOpacity(n)}
                  onMouseEnter={() => setHover(hoverProbeFor(n))}
                  onMouseLeave={() => { setHover(null); setTooltip(null); }}
                  onMouseMove={n.kind === 'code' ? (e) => handleCodeMouseMove(n, e) : undefined}
                  onClick={clickable ? () => handleNodeClick(n) : undefined}
                  style={{ cursor: clickable ? 'pointer' : 'default', transition: 'opacity 0.15s' }}
                >
                  <rect
                    x={n.x0}
                    y={n.y0}
                    width={n.x1 - n.x0}
                    height={Math.max(1, n.y1 - n.y0)}
                    fill={n.kind === 'source' ? '#0f0d0a' : n.color}
                    stroke="#0f0d0a"
                    strokeWidth="1"
                    role={clickable ? 'button' : undefined}
                    aria-label={
                      n.kind === 'code' ? `Edit code ${n.label}`
                        : n.kind === 'theme' ? `Isolate theme ${n.label}`
                        : undefined
                    }
                    tabIndex={clickable ? 0 : undefined}
                    onKeyDown={clickable ? (e) => { if (e.key === 'Enter') handleNodeClick(n); } : undefined}
                  />
                  <text
                    x={labelOnRight ? n.x1 + 8 : n.x0 - 8}
                    y={(n.y0 + n.y1) / 2}
                    dy="0.35em"
                    textAnchor={labelOnRight ? 'start' : 'end'}
                    fontSize="14"
                    fontWeight={n.kind === 'theme' ? 700 : 500}
                    fill="#0f0d0a"
                  >
                    {warn ? `⚠ ${n.label}` : n.label}
                    {warn && <title>Grounded in a single source — consider whether this theme rests on one voice</title>}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* optional subtheme column */}
          {hasSubthemes && (
            <button
              onClick={() => setIncludeSubthemes(v => !v)}
              aria-pressed={includeSubthemes}
              className="absolute top-3 right-3 px-3 py-1.5 text-sm font-bold border-2 border-[#0f0d0a] cursor-pointer"
              style={{
                backgroundColor: includeSubthemes ? '#0f0d0a' : '#ffffff',
                color: includeSubthemes ? '#ffffff' : '#0f0d0a',
              }}
            >
              Subthemes: {includeSubthemes ? 'On' : 'Off'}
            </button>
          )}

          {/* exit flow isolation */}
          {isolatedThemeId && (
            <button
              onClick={() => setIsolatedThemeId(null)}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 font-bold text-base border-2 border-[#0f0d0a] bg-[#0f0d0a] text-white cursor-pointer"
            >
              ✕ Show All Themes
            </button>
          )}
        </div>
      )}

      {/* reused quote tooltip on code hover (positions relative to the wrap div) */}
      <QuoteTooltip
        visible={!!tooltip}
        x={tooltip?.x ?? 0}
        y={tooltip?.y ?? 0}
        code={tooltip?.node?.label ?? ''}
        quote={tooltip?.node?.quote ?? ''}
        source={tooltip?.node?.source ?? ''}
        color={tooltip?.node?.color ?? '#0f0d0a'}
      />
    </div>
  );
}
