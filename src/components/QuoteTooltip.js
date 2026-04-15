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
 *
 * The tooltip auto-flips left if too close to the right edge of the screen.
 */

import React, { useRef, useEffect, useState } from 'react';

export default function QuoteTooltip({ visible, x, y, code, quote, source, color }) {
  const ref   = useRef(null);
  const [pos, setPos] = useState({ left: x + 18, top: y - 10 });
  // Tracks whether position has been corrected this show-cycle to avoid a one-frame flash
  const [ready, setReady] = useState(false);

  // Reset ready flag whenever the tooltip transitions from hidden to visible
  useEffect(() => {
    if (!visible) {
      setReady(false);
    }
  }, [visible]);

  // Adjust position to stay within viewport bounds
  useEffect(() => {
    if (!ref.current || !visible) return;
    const el    = ref.current;
    const rect  = el.getBoundingClientRect();
    const vw    = window.innerWidth;

    let left = x + 18;
    let top  = y - 10;

    // Flip left if overflowing right edge
    if (left + rect.width > vw - 16) left = x - rect.width - 18;
    // Keep inside bottom edge
    if (top + rect.height > window.innerHeight - 16) top = window.innerHeight - rect.height - 16;
    // Clamp against left and top edges
    if (left < 16) left = 16;
    if (top < 16) top = 16;

    setPos(prev => {
      if (prev.left === left && prev.top === top) return prev;
      return { left, top };
    });
    setReady(true);
  }, [visible, x, y]);

  if (!visible) return null;

  return (
    <div
      ref={ref}
      role="tooltip"
      style={{
        left: pos.left,
        top: pos.top,
        borderColor: color + '55', /* '55' ≈ 33% opacity in hex */
        opacity: ready ? 1 : 0,
      }}
      className="
        absolute z-50 pointer-events-none
        bg-slate-800 border rounded-xl
        p-4 max-w-sm shadow-2xl
        transition-opacity duration-150
      "
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
