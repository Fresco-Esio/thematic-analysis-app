/**
 * PhysicsPanel.js
 * ──────────────────────────────────────────────────────────────────────────
 * Collapsible sidebar with sliders to control the D3 force simulation.
 * Changes are applied live and persisted to localStorage.
 *
 * PROPS:
 *   open     {boolean}
 *   params   {Object}  — current physics params
 *   onChange {fn}      — called with updated params object
 *   onClose  {fn}      — called to close the panel
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { savePhysicsParams } from '../utils/forceSimulation';

const SLIDERS = [
  { key: 'linkDistance',    label: 'Link Distance',    min: 60,   max: 400,  step: 10, unit: 'px' },
  { key: 'repulsion',       label: 'Repulsion',        min: -600, max: -50,  step: 10, unit: ''   },
  { key: 'collisionRadius', label: 'Collision Radius', min: 30,   max: 180,  step: 5,  unit: 'px' },
  { key: 'linkStrength',    label: 'Link Strength',    min: 0,    max: 100,  step: 5,  unit: '%', transform: v => v / 100 },
  { key: 'velocityDecay',   label: 'Velocity Decay',   min: 0,    max: 100,  step: 5,  unit: '%', transform: v => v / 100 },
  { key: 'gravity',         label: 'Center Pull',      min: 0,    max: 15,   step: 1,  unit: '%', transform: v => v / 100 },
];

const AUTO_CLOSE_MS = 10000; // auto-close after 10 s of no interaction

export default function PhysicsPanel({ open, params, onChange, onClose }) {
  const panelRef = useRef(null);
  const timerRef = useRef(null);

  const resetTimer = useCallback(() => {
    clearTimeout(timerRef.current);
    if (open && onClose) {
      timerRef.current = setTimeout(onClose, AUTO_CLOSE_MS);
    }
  }, [open, onClose]);

  // Start/stop auto-close timer when panel opens/closes
  useEffect(() => {
    if (open) {
      resetTimer();
    } else {
      clearTimeout(timerRef.current);
    }
    return () => clearTimeout(timerRef.current);
  }, [open, resetTimer]);

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose?.();
      }
    }
    // slight delay so the toggle-button click that opens the panel
    // doesn't immediately close it via the same event
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 100);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', handler);
    };
  }, [open, onClose]);

  function handleChange(key, rawValue, transform) {
    const value   = transform ? transform(rawValue) : rawValue;
    const updated = { ...params, [key]: value };
    onChange(updated);
    savePhysicsParams(updated);
    resetTimer();
  }

  function displayValue(key, value, transform) {
    return transform ? Math.round(value * 100) : value;
  }

  return (
    <div
      ref={panelRef}
      style={{
        width: open ? 290 : 0,
        minWidth: open ? 290 : 0,
        overflow: 'hidden',
        background: '#ffffff',
        borderLeft: open ? '2px solid #0f0d0a' : 'none',
        boxShadow: open ? '-6px 0 0 #0f0d0a' : 'none',
        transition: 'width 0.25s ease, min-width 0.25s ease',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
      }}
      onMouseMove={resetTimer}
    >
      {open && (
        <div style={{
          padding: '16px 18px 18px',
          display: 'flex', flexDirection: 'column', gap: 14,
          height: '100%', overflowY: 'auto',
          // prevent content from rendering while collapsing (avoids flash)
          minWidth: 290,
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <h3 style={{
              fontSize: 11, fontWeight: 700, color: '#0f0d0a',
              textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0,
            }}>
              Physics Controls
            </h3>
            <button
              onClick={onClose}
              aria-label="Close physics panel"
              title="Close panel (or click outside)"
              style={{
                background: 'transparent', border: '2px solid #0f0d0a', cursor: 'pointer',
                color: '#0f0d0a', fontSize: 16, lineHeight: 1,
                padding: '2px 6px',
                transition: 'color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.background = '#0f0d0a'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#0f0d0a'; e.currentTarget.style.background = 'transparent'; }}
            >
              ✕
            </button>
          </div>

          {SLIDERS.map(({ key, label, min, max, step, unit, transform }) => {
            const raw = displayValue(key, params[key], transform);
            return (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#0f0d0a' }}>
                  <span style={{ fontWeight: 600 }}>{label}</span>
                  <span style={{ color: '#0f0d0a', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {raw}{unit}
                  </span>
                </div>
                <input
                  type="range"
                  min={min} max={max} step={step}
                  value={raw}
                  aria-label={label}
                  onChange={e => handleChange(key, Number(e.target.value), transform)}
                  style={{ width: '100%', accentColor: '#dc2626', cursor: 'pointer' }}
                />
              </div>
            );
          })}

          <button
            onClick={() => {
              const { DEFAULT_PHYSICS } = require('../utils/forceSimulation');
              onChange({ ...DEFAULT_PHYSICS });
              savePhysicsParams({ ...DEFAULT_PHYSICS });
              resetTimer();
            }}
            style={{
              marginTop: 'auto', fontSize: 13, fontWeight: 700,
              color: '#0f0d0a', background: 'transparent',
              border: '2px solid #0f0d0a',
              padding: '7px 0', cursor: 'pointer',
              transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.background = '#0f0d0a'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#0f0d0a'; e.currentTarget.style.background = 'transparent'; }}
          >
            Reset Defaults
          </button>
        </div>
      )}
    </div>
  );
}
