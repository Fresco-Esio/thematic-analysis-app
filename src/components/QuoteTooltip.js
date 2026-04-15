/**
 * QuoteTooltip.js
 * ──────────────────────────────────────────────────────────────────────────
 * Floating tooltip shown when hovering a code node.
 * Displays the raw interview quote, data code label, and source document.
 *
 * PROPS:
 *   visible  {boolean}  — whether to show
 *   x        {number}   — mouse X (canvas-relative)
 *   y        {number}   — mouse Y (canvas-relative)
 *   code     {string}   — data code label
 *   quote    {string}   — raw interview quote
 *   source   {string}   — source document name
 *   color    {string}   — accent color matching the code node
 */

import React from 'react';

const TOOLTIP_WIDTH = 320; // matches max-w-sm (320px)

export default function QuoteTooltip({ visible, x, y, code, quote, source, color }) {
  if (!visible) return null;

  // Compute position synchronously — no effect lag
  const left = Math.min(x + 18, window.innerWidth  - TOOLTIP_WIDTH - 16);
  const top  = Math.min(Math.max(y - 10, 16), window.innerHeight - 16);

  return (
    <div
      role="tooltip"
      style={{
        position: 'absolute',
        left,
        top,
        borderColor: color + '55',
        pointerEvents: 'none',
        zIndex: 50,
      }}
      className="bg-slate-800 border rounded-xl p-4 max-w-sm shadow-2xl"
    >
      {/* Code label */}
      <p className="text-base font-bold mb-2" style={{ color }}>
        {code}
      </p>

      {/* Raw quote */}
      <p className="text-base text-slate-200 italic leading-relaxed mb-3">
        "{quote}"
      </p>

      {/* Source */}
      <p className="text-base text-slate-500 font-semibold uppercase tracking-wide">
        ↳ {source || 'Unknown source'}
      </p>
    </div>
  );
}
