/**
 * CodeNode.js
 * ──────────────────────────────────────────────────────────────────────────
 * Renders a single data code as a circular node on the canvas.
 *
 * VISUAL STATES:
 *   - Default:    colored circle (color from theme), code label inside
 *   - Unassigned: gray circle, muted label
 *   - Hover:      scale up slightly, show QuoteTooltip (handled by Canvas.js)
 *   - Selected:   ring highlight (for connection mode)
 *   - Connecting: glowing pulse to indicate it's the source of a new edge
 *
 * PROPS:
 *   node           {Object}   — code node data from GraphContext
 *   position       {x, y}    — D3-managed screen position
 *   isSelected     {boolean}
 *   isConnecting   {boolean}  — true when this is the source node in connect mode
 *   connectMode    {boolean}  — true when toolbar connect mode is active
 *   onMouseEnter   {fn}
 *   onMouseLeave   {fn}
 *   onDoubleClick  {fn}
 *   onContextMenu  {fn}
 *   onMouseDown    {fn}       — drag start
 *   onClick        {fn}       — used in connect mode to select source/target
 */

import React from 'react';
import { motion } from 'framer-motion';

// Code nodes are 130px diameter
export const CODE_NODE_SIZE = 130;

export default function CodeNode({
  node,
  position,
  isSelected,
  isConnecting,
  connectMode,
  onMouseEnter,
  onMouseLeave,
  onDoubleClick,
  onContextMenu,
  onMouseDown,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}) {
  const { label, color } = node;
  const size = CODE_NODE_SIZE;

  // Truncate label to 3 lines max to avoid overflow
  const displayLabel = label.length > 60 ? label.slice(0, 57) + '…' : label;

  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{
        position:  'absolute',
        left:      position.x - size / 2,
        top:       position.y - size / 2,
        width:     size,
        height:    size,
        borderRadius: '50%',
        backgroundColor: color,
        // Ring highlight when selected or connecting
        boxShadow: isConnecting
          ? `0 0 0 4px #fff, 0 0 24px 8px ${color}`
          : isSelected
          ? `0 0 0 3px #fff, 0 0 16px 4px ${color}`
          : `0 2px 16px rgba(0,0,0,0.5)`,
        border: '2px solid rgba(255,255,255,0.25)',
        cursor: connectMode ? 'crosshair' : 'grab',
        userSelect: 'none',
        touchAction: 'none',
        pointerEvents: 'auto',
        zIndex: isSelected || isConnecting ? 20 : 10,
      }}
      whileHover={{ scale: 1.08 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onMouseDown={onMouseDown}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Inner content */}
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '12px', textAlign: 'center',
      }}>
        {/* Code label */}
        <span style={{
          fontSize: 16,
          fontWeight: 600,
          lineHeight: 1.25,
          color: 'rgba(255,255,255,0.95)',
          wordBreak: 'break-word',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
        }}>
          {displayLabel}
        </span>
      </div>
    </motion.div>
  );
}
