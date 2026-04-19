/**
 * GraphNode.js
 * ──────────────────────────────────────────────────────────────────────────
 * Unified node component for both theme (planet) and code (satellite) nodes.
 *
 * Replaces ThemeNode.js and CodeNode.js.
 *
 * PROPS:
 *   node                    {Object}        — node data from GraphContext
 *   position                {x, y}          — D3-managed screen position
 *   isSelected              {boolean}
 *   isConnecting            {boolean}
 *   connectMode             {boolean}
 *   focusThemeId            {string|null}   — if set, dims nodes outside the focused cluster
 *   focusedNodeIds          {Set<string>}   — set of IDs in the focused cluster (or empty)
 *   isCollapsed             {boolean}       — true if this code node is hidden (parent collapsed)
 *   collapsingIntoPosition  {{x,y}|null}    — world-coord position of the parent node to fly toward
 *   collapsedCodeCount      {number}        — for subtheme nodes, number of codes collapsed into them
 *   onMouseEnter            {fn}
 *   onMouseLeave            {fn}
 *   onContextMenu           {fn}
 *   onClick                 {fn}
 *   onPointerDown           {fn}
 *   onPointerMove           {fn}
 *   onPointerUp             {fn}
 */

import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  searchActive = false,
  isSearchMatch = false,
  isCollapsed = false,
  collapsingIntoPosition = null,
  collapsedCodeCount = 0,
  onMouseEnter = () => {},
  onMouseLeave = () => {},
  onContextMenu,
  onClick = () => {},
  onPointerDown,
  onPointerMove,
  onPointerUp,
}) {
  const isTheme = node.type === 'theme';
  const isSubtheme = node.type === 'subtheme';
  const { diameter, fontSize, width: subthemeWidth } = getNodeSize(node);
  const radius = isSubtheme ? null : diameter / 2;
  const color = node.color || (isTheme ? '#6366f1' : '#64748b');

  // Opacity: dim based on search state or focus state
  let opacity = 1;
  if (searchActive) {
    opacity = isSearchMatch ? 1 : 0.25;
  } else if (focusThemeId) {
    const isFocused = focusedNodeIds.has(node.id);
    opacity = isFocused ? 1 : 0.2;
  }

  // Box shadow: hard offset (Neo-Brutalist) + optional glow for states
  const getBoxShadow = () => {
    // Search match takes precedence
    if (searchActive && isSearchMatch) {
      return `4px 4px 0 #dc2626`;
    }
    if (isConnecting) {
      return `0 0 0 4px #fff, 0 0 24px 8px ${color}`;
    }
    if (isSelected) {
      return `0 0 0 3px #fff, 0 0 16px 4px ${color}`;
    }
    if (isSubtheme) {
      return `6px 6px 0 ${color}88`;
    }
    if (isTheme) {
      // Planet: hard shadow in semi-transparent theme color
      return `6px 6px 0 ${color}88`;
    }
    // Code node: hard black shadow
    return `4px 4px 0 #0f0d0a`;
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
    collapsed: {
      scale: 0,
      opacity: 0,
      x: collapsingIntoPosition ? collapsingIntoPosition.x - (position?.x ?? 0) : 0,
      y: collapsingIntoPosition ? collapsingIntoPosition.y - (position?.y ?? 0) : 0,
      transition: { type: 'spring', stiffness: 300, damping: 28 },
    },
    dot: {
      scale: 0.18,
      opacity: 0.6,
      transition: { type: 'spring', stiffness: 280, damping: 25 },
    },
  };

  // Border: theme/subtheme nodes get 3px solid black, code nodes 2px solid black
  const borderWidth = (isTheme || isSubtheme) ? 3 : 2;
  const borderColor = '#0f0d0a';

  return (
    <motion.div
      className={isTheme ? 'graph-node graph-node--theme' : isSubtheme ? 'graph-node graph-node--subtheme' : 'graph-node graph-node--code'}
      initial="initial"
      animate={
        isCollapsed   ? 'collapsed'  :
        isConnecting  ? 'connecting' :
        'visible'
      }
      variants={variants}
      whileHover={{ scale: isTheme ? 1.06 : 1.08, transition: springs.hover }}
      whileTap={{ scale: 0.97 }}
      role="button"
      tabIndex={0}
      data-node-type={node.type}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onKeyDown={handleKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      aria-label={`${node.label || 'Unnamed'} — ${isTheme ? 'theme' : isSubtheme ? 'subtheme' : 'code'} node`}
      aria-pressed={isSelected}
      style={{
        position:        'absolute',
        left:            position ? (isSubtheme ? position.x - subthemeWidth / 2 : position.x - radius) : 0,
        top:             position ? (isSubtheme ? position.y - 24 : position.y - radius) : 0,
        width:           isSubtheme ? subthemeWidth : diameter,
        height:          isSubtheme ? 'auto'        : diameter,
        minHeight:       isSubtheme ? 48            : undefined,
        borderRadius:    isSubtheme ? 12            : '50%',
        backgroundColor: (isTheme || isSubtheme) ? color : '#ffffff',
        border:          `${borderWidth}px solid ${borderColor}`,
        boxShadow:       getBoxShadow(),
        cursor:          connectMode ? 'crosshair' : 'grab',
        touchAction:     'none',
        pointerEvents:   'auto',
        userSelect:      'none',
        zIndex:          isSelected || isConnecting ? 20 : (isTheme ? 12 : (isSubtheme ? 11 : 10)),
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         0,
        background:      (isTheme || isSubtheme) ? color : '#ffffff', // override button default
        outline:         'none', // handled by focus-visible below
      }}
    >
      {/* Label */}
      <span
        style={{
          textAlign:    'center',
          padding:      isTheme ? '10px 18px' : (isSubtheme ? '10px 18px' : '10px 14px'),
          color:        (isTheme || isSubtheme) ? 'white' : '#0f0d0a',
          fontSize:     fontSize,
          fontWeight:   (isTheme || isSubtheme) ? 700 : 600,
          lineHeight:   1.2,
          wordBreak:    'break-word',
          // No truncation — label always fully visible
        }}
      >
        {node.label || (isTheme ? 'Untitled Theme' : isSubtheme ? 'Untitled Subtheme' : 'Untitled Code')}
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

      {/* Collapsed-code count badge on subtheme */}
      <AnimatePresence>
        {isSubtheme && collapsedCodeCount > 0 && (
          <motion.span
            key="collapse-badge"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            aria-label={`${collapsedCodeCount} collapsed codes`}
            style={{
              position:        'absolute',
              top:             -10,
              right:           -10,
              width:           22,
              height:          22,
              borderRadius:    '50%',
              backgroundColor: 'white',
              border:          '2px solid #0f0d0a',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              fontSize:        11,
              fontWeight:      700,
              color:           color,
              lineHeight:      1,
              pointerEvents:   'none',
            }}
          >
            {collapsedCodeCount}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
