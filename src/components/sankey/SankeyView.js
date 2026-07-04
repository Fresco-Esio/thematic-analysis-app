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

const FIG_W = 1280;
const FIG_H = 800; // 16:10 — fixed figure aspect ratio for export
const MARGIN = { top: 64, right: 210, bottom: 28, left: 210 };
const RIBBON_OPACITY = 0.8; // design §5: theme palette at ~80% opacity

export default function SankeyView({ onEditCode, onImport }) {
  const { nodes, edges } = useGraph();
  const wrapRef = useRef(null);
  const [frame, setFrame] = useState({ w: 960, h: 600 });

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

  const data = useMemo(
    () => buildSankeyData(nodes, edges, { includeSubthemes: false }),
    [nodes, edges]
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
  const headerLabels = ['SOURCES', 'CODES', 'THEMES'];

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
                  strokeOpacity={RIBBON_OPACITY}
                  role="img"
                  aria-label={`${l.source.label} flows into ${l.target.label}`}
                  style={{ transition: 'stroke-opacity 0.15s' }}
                />
              ))}
            </g>

            {/* node bars + labels */}
            {layout.nodes.map(n => {
              const labelOnRight = n.x0 < FIG_W / 2;
              return (
                <g key={n.id}>
                  <rect
                    x={n.x0}
                    y={n.y0}
                    width={n.x1 - n.x0}
                    height={Math.max(1, n.y1 - n.y0)}
                    fill={n.kind === 'source' ? '#0f0d0a' : n.color}
                    stroke="#0f0d0a"
                    strokeWidth="1"
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
                    {n.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
