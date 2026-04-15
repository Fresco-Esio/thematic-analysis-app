/**
 * ContextMenu.js
 * ──────────────────────────────────────────────────────────────────────────
 * Right-click context menu that appears over nodes and edges.
 *
 * PROPS:
 *   visible   {boolean}
 *   x         {number}
 *   y         {number}
 *   items     {Array<{label, action, danger?}>}
 *   onClose   {fn}
 */

import React, { useEffect, useRef } from 'react';

export default function ContextMenu({ visible, x, y, items, onClose }) {
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!visible) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [visible, onClose]);

  // Auto-dismiss after 5 s of no interaction
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [visible, onClose]);

  if (!visible) return null;

  // Adjust so menu doesn't overflow viewport
  const vw  = window.innerWidth;
  const vh  = window.innerHeight;
  const est = items.length * 44 + 16;
  const left = x + 200 > vw ? x - 200 : x;
  const top  = y + est  > vh ? y - est  : y;

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', left, top, zIndex: 500,
        background: '#1e293b', border: '1px solid #334155',
        borderRadius: 10, overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        minWidth: 180,
      }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.action(); onClose(); }}
          style={{
            display: 'block', width: '100%',
            padding: '10px 16px', textAlign: 'left',
            fontSize: 16, fontWeight: 500,
            color: item.danger ? '#f87171' : '#e2e8f0',
            background: 'transparent', border: 'none', cursor: 'pointer',
            borderBottom: i < items.length - 1 ? '1px solid #0f172a' : 'none',
          }}
          onMouseEnter={e => e.currentTarget.style.background = item.danger ? '#7f1d1d33' : '#334155'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}