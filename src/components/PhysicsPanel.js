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
 */

import React from 'react';
import { savePhysicsParams } from '../utils/forceSimulation';

const SLIDERS = [
  { key: 'linkDistance',    label: 'Link Distance',     min: 60,   max: 400,  step: 10,  unit: 'px' },
  { key: 'repulsion',       label: 'Repulsion',         min: -600, max: -50,  step: 10,  unit: ''   },
  { key: 'collisionRadius', label: 'Collision Radius',  min: 30,   max: 180,  step: 5,   unit: 'px' },
  { key: 'linkStrength',    label: 'Link Strength',     min: 0,    max: 100,  step: 5,   unit: '%', transform: v => v / 100 },
  { key: 'velocityDecay',   label: 'Velocity Decay',    min: 0,    max: 100,  step: 5,   unit: '%', transform: v => v / 100 },
];

export default function PhysicsPanel({ open, params, onChange }) {
  function handleChange(key, rawValue, transform) {
    const value   = transform ? transform(rawValue) : rawValue;
    const updated = { ...params, [key]: value };
    onChange(updated);
    savePhysicsParams(updated);
  }

  // For display: convert 0–1 range sliders to 0–100 for the input
  function displayValue(key, value, transform) {
    return transform ? Math.round(value * 100) : value;
  }

  return (
    <div style={{
      position: 'absolute', right: 0, top: 0, bottom: 0,
      width: open ? 300 : 0,
      overflow: 'hidden',
      background: '#1e293b',
      borderLeft: open ? '1px solid #334155' : 'none',
      transition: 'width 0.25s ease',
      zIndex: 80,
      display: 'flex', flexDirection: 'column',
      padding: open ? '20px' : 0,
      gap: 20,
    }}>
      {open && (
        <>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
            Physics Controls
          </h3>

          {SLIDERS.map(({ key, label, min, max, step, unit, transform }) => {
            const raw = displayValue(key, params[key], transform);
            return (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, color: '#94a3b8' }}>
                  <span>{label}</span>
                  <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{raw}{unit}</span>
                </div>
                <input
                  type="range"
                  min={min} max={max} step={step}
                  value={raw}
                  onChange={e => handleChange(key, Number(e.target.value), transform)}
                  style={{ width: '100%', accentColor: '#6366f1' }}
                />
              </div>
            );
          })}

          <button
            onClick={() => {
              const { DEFAULT_PHYSICS } = require('../utils/forceSimulation');
              onChange({ ...DEFAULT_PHYSICS });
              savePhysicsParams({ ...DEFAULT_PHYSICS });
            }}
            style={{
              marginTop: 'auto', fontSize: 16, fontWeight: 600,
              color: '#94a3b8', background: 'transparent',
              border: '1px solid #334155', borderRadius: 8,
              padding: '8px 0', cursor: 'pointer',
            }}
          >
            Reset Defaults
          </button>
        </>
      )}
    </div>
  );
}
