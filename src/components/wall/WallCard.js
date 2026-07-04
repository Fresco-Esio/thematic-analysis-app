/**
 * WallCard.js
 * ──────────────────────────────────────────────────────────────────────────
 * Index-card rendering of a code node on the Research Wall. Reuses node
 * data unchanged; `inTray` switches from absolute wall placement to static
 * flow inside the margin tray.
 */

import React from 'react';

export const CARD_W = 176;
export const CARD_H = 96;

export default function WallCard({ node, position, contested = false, inTray = false,
  rotate = 0, pileCount = 0, onPileClick,
  onPointerDown, onPointerMove, onPointerUp, onContextMenu, onKeyDown, onKeyUp }) {
  const quoteLine = (node.quote || '').split('\n')[0];
  return (
    <div
      role="button"
      tabIndex={0}
      data-node-type="code"
      data-card-id={node.id}
      aria-label={`${node.label || 'Unnamed'} — code card${contested ? ', contested between regions' : ''}${pileCount > 1 ? `, pile of ${pileCount}` : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={onContextMenu}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      style={{
        position: inTray ? 'relative' : 'absolute',
        // Above region label plates (zIndex 1) — a card must always win the
        // pointer, or it becomes ungrabbable when it sits under a plate
        zIndex: inTray ? undefined : 2,
        left: inTray ? undefined : position.x - CARD_W / 2,
        top:  inTray ? undefined : position.y - CARD_H / 2,
        width: CARD_W, minHeight: CARD_H,
        backgroundColor: '#ffffff',
        border: '2px solid #0f0d0a',
        borderTop: `6px solid ${node.color || '#6b7280'}`,
        boxShadow: '4px 4px 0 #0f0d0a',
        padding: '8px 10px', cursor: 'grab',
        touchAction: 'none', userSelect: 'none',
        display: 'flex', flexDirection: 'column', gap: 4,
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
      }}
    >
      <span style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2, color: '#0f0d0a' }}>
        {node.label || 'Untitled Code'}
      </span>
      {quoteLine && (
        <span style={{ fontSize: 12, fontStyle: 'italic', color: '#6b6560',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          "{quoteLine}"
        </span>
      )}
      {node.source && (
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: '#6b6560', marginTop: 'auto', alignSelf: 'flex-end' }}>
          {node.source}
        </span>
      )}
      {contested && (
        <span aria-hidden="true" style={{ position: 'absolute', top: -8, left: -8,
          width: 18, height: 18, backgroundColor: '#dc2626', color: 'white',
          fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center',
          justifyContent: 'center', border: '2px solid #0f0d0a' }}>?</span>
      )}
      {pileCount > 1 && (
        <span
          role="button"
          tabIndex={0}
          data-pile-badge={node.id}
          aria-label={`Fan out pile of ${pileCount} cards`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onPileClick?.(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onPileClick?.(); } }}
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
            fontWeight:      800,
            color:           '#0f0d0a',
            cursor:          'pointer',
            lineHeight:      1,
          }}
        >
          {pileCount}
        </span>
      )}
    </div>
  );
}
