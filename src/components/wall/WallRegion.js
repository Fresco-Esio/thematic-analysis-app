/**
 * WallRegion.js
 * ──────────────────────────────────────────────────────────────────────────
 * A theme's territory on the Research Wall: a tinted rectangle with a label
 * plate (drag to move) and a bottom-right handle (drag to resize). Geometry
 * changes are tracked locally during the gesture and committed with ONE
 * `UPDATE_REGION {rect}` dispatch on release (non-undoable by design).
 *
 * Right-click anywhere on the region forwards to the existing theme context
 * menu, so rename/recolor/delete work identically to the Graph view.
 * Elements marked `data-region-drag` are excluded from the wall's d3.zoom
 * filter (their drags must not pan the wall).
 */

import React, { useRef, useState } from 'react';

const MIN_W = 160;
const MIN_H = 120;

export default function WallRegion({ region, color, label, zoomK, onCommitRect, onContextMenu }) {
  // Live rect during a move/resize gesture; null when idle
  const [liveRect, setLiveRect] = useState(null);
  const dragRef = useRef(null); // { mode: 'move'|'resize', startX, startY, startRect, lastRect }
  const rect = liveRect ?? region.rect;

  function handlePointerDown(mode, e) {
    if (e.button !== 0) return;
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic/lost pointer */ }
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, startRect: region.rect, lastRect: null };
  }

  function handlePointerMove(e) {
    const d = dragRef.current;
    if (!d || !(e.buttons & 1)) return;
    const k = zoomK();
    const dx = (e.clientX - d.startX) / k;
    const dy = (e.clientY - d.startY) / k;
    d.lastRect = d.mode === 'move'
      ? { ...d.startRect, x: d.startRect.x + dx, y: d.startRect.y + dy }
      : { ...d.startRect, w: Math.max(MIN_W, d.startRect.w + dx), h: Math.max(MIN_H, d.startRect.h + dy) };
    setLiveRect(d.lastRect);
  }

  function handlePointerUp(e) {
    const d = dragRef.current;
    if (!d) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* synthetic/lost pointer */ }
    dragRef.current = null;
    setLiveRect(null);
    if (d.lastRect) onCommitRect(d.lastRect);
  }

  function handleContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(e.clientX, e.clientY);
  }

  return (
    <div
      data-region-id={region.id}
      onContextMenu={handleContextMenu}
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        backgroundColor: `${color}22`,
        border: `3px solid ${color}`,
      }}
    >
      {/* Label plate — drag to move the region */}
      <div
        data-region-drag="move"
        role="button"
        tabIndex={0}
        aria-label={`${label} — theme region`}
        onPointerDown={(e) => handlePointerDown('move', e)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          position: 'absolute',
          top: -3,
          left: -3,
          maxWidth: 'calc(100% + 6px)',
          padding: '4px 12px',
          backgroundColor: color,
          color: 'white',
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          cursor: 'grab',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        {label}
      </div>

      {/* Resize handle */}
      <div
        data-region-drag="resize"
        aria-hidden="true"
        onPointerDown={(e) => handlePointerDown('resize', e)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          position: 'absolute',
          right: -3,
          bottom: -3,
          width: 16,
          height: 16,
          backgroundColor: color,
          border: '2px solid #0f0d0a',
          cursor: 'nwse-resize',
          touchAction: 'none',
        }}
      />
    </div>
  );
}
