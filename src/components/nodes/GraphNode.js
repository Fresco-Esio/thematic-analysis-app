/**
 * GraphNode.js
 * ──────────────────────────────────────────────────────────────────────────
 * Unified node component for both theme (planet) and code (satellite) nodes.
 *
 * Replaces ThemeNode.js and CodeNode.js.
 *
 * PROPS:
 *   node           {Object}   — node data from GraphContext
 *   position       {x, y}    — D3-managed screen position
 *   isSelected     {boolean}
 *   isConnecting   {boolean}
 *   connectMode    {boolean}
 *   focusThemeId   {string|null} — if set, dims nodes outside the focused cluster
 *   focusedNodeIds {Set<string>} — set of IDs in the focused cluster (or empty)
 *   onMouseEnter   {fn}
 *   onMouseLeave   {fn}
 *   onContextMenu  {fn}
 *   onClick        {fn}
 *   onPointerDown  {fn}
 *   onPointerMove  {fn}
 *   onPointerUp    {fn}
 */

import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { getNodeSize } from '../../utils/nodeUtils';
import { springs } from '../../utils/motionConfig';

export default function GraphNode({
  node,
  position,
  isSelected = false,
  isConnecting = false,
  connectMode = false,
  focusThemeId = null,
  focusedNodeIds = new Set(),
  onMouseEnter = () => {},
  onMouseLeave = () => {},
  onContextMenu,
  onClick = () => {},
  onPointerDown,
  onPointerMove,
  onPointerUp,
}) {
  const isTheme = node.type === 'theme';
  const { diameter, fontSize } = getNodeSize(node);
  const radius = diameter / 2;
  const color = node.color || (isTheme ? '#6366f1' : '#64748b');

  // Opacity: dim if focus is active and this node is not in the focused cluster
  const isFocused = !focusThemeId || focusedNodeIds.has(node.id);
  const opacity = isFocused ? 1 : 0.2;

  // Box shadow: hard offset (Neo-Brutalist) + optional glow for states
  const getBoxShadow = () => {
    if (isConnecting) {
      return `0 0 0 4px #fff, 0 0 24px 8px ${color}`;
    }
    if (isSelected) {
      return `0 0 0 3px #fff, 0 0 16px 4px ${color}`;
    }
    if (isTheme) {
      // Planet: stronger hard shadow in theme color
      return `6px 6px 0 ${color}88`;
    }
    // Satellite: lighter hard shadow
    return `4px 4px 0 rgba(0,0,0,0.35)`;
  };

  // Keyboard handler for accessibility
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(e);
    }
  }, [onClick]);

  // Motion variants
  const variants = {
    initial:    { scale: 0.6, opacity: 0 },
    visible:    { scale: isSelected ? 1.04 : 1, opacity, transition: springs.entrance },
    connecting: {
      scale: 1.08,
      opacity: [opacity, opacity * 0.8, opacity],
      transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
    },
  };

  // Border: theme nodes get 3px, code nodes 2px
  const borderWidth = isTheme ? 3 : 2;
  const borderColor = isTheme ? 'white' : 'rgba(255,255,255,0.25)';

  return (
    <motion.button
      className={isTheme ? 'graph-node graph-node--theme' : 'graph-node graph-node--code'}
      initial="initial"
      animate={isConnecting ? 'connecting' : 'visible'}
      variants={variants}
      whileHover={{ scale: isTheme ? 1.06 : 1.08, transition: springs.hover }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onKeyDown={handleKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      aria-label={`${node.label || 'Unnamed'} — ${isTheme ? 'theme' : 'code'} node`}
      aria-pressed={isSelected}
      style={{
        position:        'absolute',
        left:            position ? position.x - radius : 0,
        top:             position ? position.y - radius : 0,
        width:           diameter,
        height:          diameter,
        borderRadius:    '50%',
        backgroundColor: color,
        border:          `${borderWidth}px solid ${borderColor}`,
        boxShadow:       getBoxShadow(),
        cursor:          connectMode ? 'crosshair' : 'grab',
        touchAction:     'none',
        pointerEvents:   'auto',
        userSelect:      'none',
        zIndex:          isSelected || isConnecting ? 20 : (isTheme ? 12 : 10),
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         0,
        background:      color, // override button default
        outline:         'none', // handled by focus-visible below
      }}
    >
      {/* Label */}
      <span
        style={{
          textAlign:    'center',
          padding:      isTheme ? '10px 18px' : '10px 14px',
          color:        'white',
          fontSize:     fontSize,
          fontWeight:   isTheme ? 700 : 600,
          lineHeight:   1.2,
          wordBreak:    'break-word',
          // No truncation — label always fully visible
        }}
      >
        {node.label || (isTheme ? 'Untitled Theme' : 'Untitled Code')}
      </span>

      {/* Theme indicator badge */}
      {isTheme && (
        <span
          aria-hidden="true"
          style={{
            position:        'absolute',
            bottom:          10,
            right:           10,
            width:           14,
            height:          14,
            borderRadius:    '50%',
            backgroundColor: 'white',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            fontSize:        10,
            fontWeight:      700,
            color:           color,
            lineHeight:      1,
          }}
        >
          ✓
        </span>
      )}
    </motion.button>
  );
}
