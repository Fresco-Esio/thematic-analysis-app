/**
 * QuoteTooltip.js
 * ──────────────────────────────────────────────────────────────────────────
 * Floating tooltip shown when hovering a code node.
 * Displays the raw interview quote, data code label, and source document.
 * Uses AnimatePresence for smooth fade in/out on mount/unmount.
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
import { AnimatePresence, motion } from 'framer-motion';
import { tooltipVariants } from '../utils/motionConfig';

const TOOLTIP_WIDTH = 320; // matches max-w-sm (320px)

export default function QuoteTooltip({ visible, x, y, code, quote, source, color }) {
  // Compute position synchronously — no effect lag
  const left = Math.min(x + 18, window.innerWidth  - TOOLTIP_WIDTH - 16);
  const top  = Math.min(Math.max(y - 10, 16), window.innerHeight - 16);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="quote-tooltip"
          variants={tooltipVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          role="tooltip"
          style={{
            position:        'absolute',
            left,
            top,
            backgroundColor: '#fff',
            border:          '2px solid #0f0d0a',
            boxShadow:       '4px 4px 0 #0f0d0a',
            borderRadius:    0,
            pointerEvents:   'none',
            zIndex:          50,
            padding:         '16px',
            maxWidth:        '320px',
            color:           '#0f0d0a',
          }}
        >
          {/* Code label */}
          <p className="text-base font-bold mb-2" style={{ color }}>
            {code}
          </p>

          {/* Raw quote */}
          <p className="text-base italic leading-relaxed mb-3" style={{ color: '#0f0d0a' }}>
            "{quote}"
          </p>

          {/* Source */}
          <p className="text-base font-semibold uppercase tracking-wide" style={{ color: '#6b6560' }}>
            ↳ {source || 'Unknown source'}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
