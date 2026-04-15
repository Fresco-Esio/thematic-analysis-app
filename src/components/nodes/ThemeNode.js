import React, { useCallback } from 'react';
import { motion } from 'framer-motion';

export const THEME_NODE_SIZE = 160;

const ThemeNode = ({
  nodeId,
  node,
  position,
  isSelected = false,
  isConnecting = false,
  onClick = () => {},
  onContextMenu,
  onMouseEnter = () => {},
  onMouseLeave = () => {},
  onPointerDown,
  onPointerMove,
  onPointerUp,
}) => {
  // Truncate label to 50 characters
  const truncatedLabel = node.label && node.label.length > 50 
    ? node.label.slice(0, 50) + '…' 
    : node.label || 'Untitled Theme';

  // Handle keyboard interaction (Enter/Space)
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(e);
    }
  }, [onClick]);

  // Determine box-shadow (glow) based on state
  const getBoxShadow = () => {
    const color = node.color || '#6366f1';
    if (isConnecting) {
      return `0 0 0 4px #fff, 0 0 24px 8px ${color}`;
    }
    if (isSelected) {
      return `0 0 0 3px #fff, 0 0 16px 4px ${color}`;
    }
    return 'none';
  };

  // Consolidated animation variants with state-driven transitions
  const variants = {
    initial: { scale: 0.6, opacity: 0 },
    visible: {
      scale: isSelected ? 1.04 : 1,
      opacity: 1,
      transition: { duration: 0.25, ease: 'easeOut' }
    },
    connecting: {
      scale: 1.08,
      opacity: [1, 0.8, 1],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut'
      }
    }
  };

  return (
    <motion.div
      className="theme-node"
      initial="initial"
      animate={isConnecting ? 'connecting' : 'visible'}
      variants={variants}
      whileHover={{ scale: 1.08 }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onKeyDown={handleKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="button"
      tabIndex={0}
      aria-label={`${truncatedLabel} theme`}
      style={{
        position: 'absolute',
        left: position ? position.x - THEME_NODE_SIZE / 2 : 0,
        top: position ? position.y - THEME_NODE_SIZE / 2 : 0,
        width: `${THEME_NODE_SIZE}px`,
        height: `${THEME_NODE_SIZE}px`,
        borderRadius: '50%',
        backgroundColor: node.color || '#6366f1',
        border: '3px solid white',
        cursor: 'grab',
        touchAction: 'none',
        pointerEvents: 'auto',
        boxShadow: getBoxShadow(),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        zIndex: isSelected || isConnecting ? 20 : 10
      }}
    >
      {/* Label */}
      <div
        style={{
          textAlign: 'center',
          padding: '8px 16px',
          color: 'white',
          fontSize: '14px',
          fontWeight: 'bold',
          lineHeight: 1.2,
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          wordBreak: 'break-word'
        }}
      >
        {truncatedLabel}
      </div>

      {/* Indicator Badge (checkmark) */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px',
          fontWeight: 'bold',
          color: node.color || '#6366f1',
          lineHeight: 1
        }}
      >
        ✓
      </div>
    </motion.div>
  );
};

export default ThemeNode;
