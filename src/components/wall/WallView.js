/**
 * WallView.js
 * ──────────────────────────────────────────────────────────────────────────
 * Research Wall — physics-free, authored-position workbench. Placeholder
 * surface for now; cards, tray, regions, and strings arrive in later tasks.
 *
 * Shares `id="canvas-export-target"` with Canvas so PNG/PDF export works on
 * whichever view is mounted (only one renders at a time).
 */

import React from 'react';

export default function WallView({ onContextMenu }) {
  return (
    <div
      id="canvas-export-target"
      className="canvas-container"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--bg-canvas)',
      }}
    />
  );
}
