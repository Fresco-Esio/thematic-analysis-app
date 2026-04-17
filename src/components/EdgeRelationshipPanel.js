/**
 * EdgeRelationshipPanel.js
 * ────────────────────────────────────────────────────────────────────────
 * A floating, draggable panel for setting the relationship type and label
 * on an edge. Appears anchored near the edge midpoint.
 *
 * PROPS:
 *   edge       {object|null}  — the edge being edited (null = hidden)
 *   anchorX    {number}       — screen-space X to anchor near
 *   anchorY    {number}       — screen-space Y to anchor near
 *   onClose    {fn}           — called when panel should dismiss
 *   onApply    {fn(relationType, label)} — called when user confirms selection
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EDGE_TYPES } from '../utils/edgeTypes';

const PANEL_WIDTH  = 232;
const PANEL_OFFSET = 16; // px from anchor point

export default function EdgeRelationshipPanel({ edge, anchorX, anchorY, onClose, onApply }) {
  const panelRef = useRef(null);
  const posRef   = useRef({ x: 0, y: 0 });

  const [selectedType, setSelectedType] = useState(null);
  const [customLabel,  setCustomLabel]  = useState('');
  const [pos, setPos] = useState({ x: 0, y: 0 });

  // Sync state when edge changes
  useEffect(() => {
    if (!edge) return;
    setSelectedType(edge.relationType ?? null);
    setCustomLabel(
      edge.relationType ? '' : (edge.label ?? '')
    );
  }, [edge?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Position panel near anchor, clamped to viewport
  useEffect(() => {
    if (!edge) return;
    const panelH = 260; // approx
    const x = Math.min(anchorX + PANEL_OFFSET, window.innerWidth  - PANEL_WIDTH - 8);
    const y = Math.min(anchorY + PANEL_OFFSET, window.innerHeight - panelH      - 8);
    const newPos = { x: Math.max(8, x), y: Math.max(8, y) };
    setPos(newPos);
    posRef.current = newPos;
  }, [edge?.id, anchorX, anchorY]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dismiss on Escape
  useEffect(() => {
    if (!edge) return;
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [edge, onClose]);

  // Dismiss on outside click
  useEffect(() => {
    if (!edge) return;
    function onDown(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [edge, onClose]);

  // ── Drag ──────────────────────────────────────────────────────────────────
  const handleGripMouseDown = useCallback((e) => {
    e.preventDefault();
    const startX = posRef.current.x;
    const startY = posRef.current.y;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    function onMove(me) {
      const newX = Math.min(Math.max(0, me.clientX - dx), window.innerWidth  - PANEL_WIDTH - 8);
      const newY = Math.min(Math.max(0, me.clientY - dy), window.innerHeight - 260        - 8);
      const newPos = { x: newX, y: newY };
      setPos(newPos);
      posRef.current = newPos;
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, []); // stable — no pos in deps

  // ── Selection logic ───────────────────────────────────────────────────────
  function handlePresetClick(typeKey) {
    const newType = selectedType === typeKey ? null : typeKey;
    setSelectedType(newType);
    setCustomLabel('');
    onApply(newType, newType ? EDGE_TYPES[typeKey].label : null);
  }

  function handleCustomChange(e) {
    setSelectedType(null);
    setCustomLabel(e.target.value);
  }

  function handleCustomApply() {
    const trimmed = customLabel.trim();
    onApply(null, trimmed || null);
  }

  function handleCustomKeyDown(e) {
    if (e.key === 'Enter') handleCustomApply();
  }

  if (!edge) return null;

  return (
    <div
      ref={panelRef}
      style={{
        position:    'fixed',
        left:        pos.x,
        top:         pos.y,
        width:       PANEL_WIDTH,
        zIndex:      600,
        background:  '#f0ebe3',
        border:      '2px solid #0f0d0a',
        boxShadow:   '4px 4px 0 #0f0d0a',
        fontFamily:  '"Bricolage Grotesque", sans-serif',
      }}
    >
      {/* Grip + title + close */}
      <div
        onMouseDown={handleGripMouseDown}
        style={{
          background:  '#0f0d0a',
          cursor:      'grab',
          padding:     '6px 10px',
          display:     'flex',
          alignItems:  'center',
          justifyContent: 'space-between',
          userSelect:  'none',
        }}
      >
        <span style={{ color: '#f0ebe3', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>
          ··· RELATIONSHIP
        </span>
        <button
          onClick={onClose}
          aria-label="Close relationship panel"
          style={{
            background: 'none', border: 'none', color: '#f0ebe3',
            fontSize: 14, fontWeight: 700, cursor: 'pointer', lineHeight: 1, padding: 0,
          }}
        >✕</button>
      </div>

      {/* Preset chips */}
      <div style={{ padding: '10px 10px 6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {Object.entries(EDGE_TYPES).map(([key, { label, dashArray }]) => {
          const isSelected = selectedType === key;
          return (
            <button
              key={key}
              onClick={() => handlePresetClick(key)}
              title={label}
              style={{
                display:      'flex',
                flexDirection:'column',
                alignItems:   'center',
                gap:          4,
                padding:      '6px 4px',
                border:       `1.5px solid #0f0d0a`,
                background:   isSelected ? '#0f0d0a' : 'transparent',
                boxShadow:    isSelected ? '2px 2px 0 #dc2626' : 'none',
                cursor:       'pointer',
                color:        isSelected ? '#f0ebe3' : '#0f0d0a',
                fontSize:     11,
                fontWeight:   700,
                fontFamily:   'inherit',
                transition:   'background 100ms, box-shadow 100ms',
              }}
            >
              {/* Mini line preview */}
              <svg width="40" height="10" style={{ display: 'block' }}>
                <line
                  x1="2" y1="5" x2="38" y2="5"
                  stroke={isSelected ? '#f0ebe3' : '#0f0d0a'}
                  strokeWidth="3.5"
                  strokeDasharray={dashArray || undefined}
                  strokeLinecap="round"
                />
              </svg>
              {label}
            </button>
          );
        })}
      </div>

      {/* Custom label input */}
      <div style={{ padding: '4px 10px 12px' }}>
        <input
          type="text"
          value={customLabel}
          onChange={handleCustomChange}
          onBlur={handleCustomApply}
          onKeyDown={handleCustomKeyDown}
          placeholder="custom label…"
          style={{
            width:       '100%',
            background:  'transparent',
            border:      'none',
            borderBottom:'2px solid #0f0d0a',
            outline:     'none',
            fontSize:    13,
            fontWeight:  700,
            fontFamily:  'inherit',
            color:       '#0f0d0a',
            padding:     '4px 0',
            boxSizing:   'border-box',
          }}
        />
      </div>
    </div>
  );
}
