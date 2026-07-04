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
import { useGraph } from '../../context/GraphContext';
import { buildSankeyData } from '../../utils/sankeyTransform';

const FIG_W = 1280;
const FIG_H = 800; // 16:10 — fixed figure aspect ratio for export

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
          <svg width="100%" height="100%" viewBox={`0 0 ${FIG_W} ${FIG_H}`} preserveAspectRatio="xMidYMid meet" />
        </div>
      )}
    </div>
  );
}
