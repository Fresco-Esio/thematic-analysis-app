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
 *
 * Keyboard: focuses the first item on open; ArrowUp/ArrowDown cycle items;
 * Escape closes. Auto-dismisses after 5 s without interaction (hovering or
 * focusing the menu resets the timer).
 */

import React, { useEffect, useRef, useCallback } from 'react';

const AUTO_DISMISS_MS = 5000;

export default function ContextMenu({ visible, x, y, items, onClose }) {
  const ref = useRef(null);
  const timerRef = useRef(null);

  const resetTimer = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onClose, AUTO_DISMISS_MS);
  }, [onClose]);

  // Close on outside click; Escape closes
  useEffect(() => {
    if (!visible) return;
    function handleDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [visible, onClose]);

  // Auto-dismiss after 5 s of no interaction
  useEffect(() => {
    if (!visible) return;
    resetTimer();
    return () => clearTimeout(timerRef.current);
  }, [visible, resetTimer]);

  // Focus the first item on open so keyboard users can act immediately
  useEffect(() => {
    if (!visible) return;
    const first = ref.current?.querySelector('[role="menuitem"]');
    first?.focus();
  }, [visible]);

  function handleMenuKeyDown(e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const els = Array.from(ref.current?.querySelectorAll('[role="menuitem"]') ?? []);
    if (els.length === 0) return;
    const idx = els.indexOf(document.activeElement);
    const next = e.key === 'ArrowDown'
      ? els[(idx + 1) % els.length]
      : els[(idx - 1 + els.length) % els.length];
    next.focus();
    resetTimer();
  }

  if (!visible) return null;

  // Adjust so menu doesn't overflow viewport
  const vw  = window.innerWidth;
  const vh  = window.innerHeight;
  const est = Math.min(items.length * 44 + 16, vh * 0.6);
  const left = x + 200 > vw ? x - 200 : x;
  const top  = y + est  > vh ? Math.max(8, y - est) : y;

  return (
    <div
      ref={ref}
      role="menu"
      onMouseMove={resetTimer}
      onFocus={resetTimer}
      onKeyDown={handleMenuKeyDown}
      style={{
        position: 'fixed', left, top, zIndex: 500,
        background: '#ffffff', border: '2px solid #0f0d0a',
        borderRadius: 0,
        boxShadow: '4px 4px 0 #0f0d0a',
        minWidth: 180,
        maxHeight: '60vh',
        overflowY: 'auto',
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
