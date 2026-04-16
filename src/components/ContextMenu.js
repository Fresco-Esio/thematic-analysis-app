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
      role="menu"
      style={{
        position: 'fixed', left, top, zIndex: 500,
        background: '#ffffff', border: '2px solid #0f0d0a',
        borderRadius: 0, overflow: 'hidden',
        boxShadow: '4px 4px 0 #0f0d0a',
        minWidth: 180,
      }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          role="menuitem"
          onClick={() => { item.action(); onClose(); }}
          style={{
            display: 'block', width: '100%',
            padding: '10px 16px', textAlign: 'left',
            fontSize: 16, fontWeight: 700,
            color: item.danger ? '#dc2626' : '#0f0d0a',
            background: 'transparent', border: 'none', cursor: 'pointer',
            borderBottom: i < items.length - 1 ? '1px solid #0f0d0a' : 'none',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = item.danger ? '#dc2626' : '#f0ebe3';
            if (item.danger) e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = item.danger ? '#dc2626' : '#0f0d0a';
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}