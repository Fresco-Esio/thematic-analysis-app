/**
 * WallView.js
 * ──────────────────────────────────────────────────────────────────────────
 * Research Wall — physics-free, authored-position workbench.
 *
 * Layout:
 *   - Margin tray (left strip): unsorted code cards — no primaryThemeId and
 *     no wallPosition yet. Dragging one onto the wall authors its position.
 *   - Wall surface: pan/zoomable plane. A transformed inner layer holds
 *     theme regions, the string-edge SVG, and absolutely positioned cards.
 *
 * Position source per code: `wallPosition` if authored; assigned codes
 * without one fall back to their physics {x, y}; otherwise → tray.
 *
 * Shares `id="canvas-export-target"` with Canvas so PNG/PDF export works on
 * whichever view is mounted (only one renders at a time).
 */

import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { useGraph } from '../../context/GraphContext';
import WallCard from './WallCard';

const TRAY_W = 208;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;

/** Resolve where a code renders on the wall, or null → margin tray */
function resolveWallPosition(node) {
  if (node.wallPosition) return node.wallPosition;
  if (node.primaryThemeId && typeof node.x === 'number' && typeof node.y === 'number') {
    return { x: node.x, y: node.y };
  }
  return null;
}

export default function WallView({ onContextMenu }) {
  const { nodes } = useGraph();

  const surfaceRef = useRef(null);
  const layerRef = useRef(null);
  const zoomTransformRef = useRef({ x: 0, y: 0, k: 1 });

  // ── Pan/zoom (d3.zoom on the surface div — no simulation, no tick loop) ──
  useEffect(() => {
    if (!surfaceRef.current) return;

    const surface = d3.select(surfaceRef.current);
    const zoomBehavior = d3.zoom()
      .scaleExtent([MIN_ZOOM, MAX_ZOOM])
      .on('zoom', (event) => {
        const t = { x: event.transform.x, y: event.transform.y, k: event.transform.k };
        zoomTransformRef.current = t;
        if (layerRef.current) {
          layerRef.current.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.k})`;
        }
      });

    surface.call(zoomBehavior);
    return () => {
      surface.on('.zoom', null);
    };
  }, []);

  const codeNodes = nodes.filter(n => n.type === 'code');
  const trayNodes = codeNodes.filter(n => !n.primaryThemeId && !n.wallPosition);
  const wallCards = codeNodes
    .map(n => ({ node: n, position: resolveWallPosition(n) }))
    .filter(c => c.position !== null);

  function handleCardContextMenu(node, e) {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.('code', node.id, e.clientX, e.clientY);
  }

  return (
    <div
      id="canvas-export-target"
      className="canvas-container"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        backgroundColor: 'var(--bg-canvas)',
      }}
    >
      {/* Margin tray — unsorted cards */}
      <div
        data-testid="wall-tray"
        style={{
          width: TRAY_W,
          flexShrink: 0,
          overflowY: 'auto',
          borderRight: '2px solid #0f0d0a',
          backgroundColor: 'var(--bg-canvas)',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: '#0f0d0a' }}>
          UNSORTED
        </span>
        {trayNodes.map(node => (
          <WallCard
            key={node.id}
            node={node}
            inTray
            onContextMenu={(e) => handleCardContextMenu(node, e)}
          />
        ))}
      </div>

      {/* Wall surface — pan/zoom plane */}
      <div
        ref={surfaceRef}
        data-testid="wall-surface"
        style={{ position: 'relative', flex: 1, overflow: 'hidden', cursor: 'grab' }}
      >
        <div
          ref={layerRef}
          style={{ position: 'absolute', top: 0, left: 0, transformOrigin: '0 0' }}
        >
          {wallCards.map(({ node, position }) => (
            <WallCard
              key={node.id}
              node={node}
              position={position}
              onContextMenu={(e) => handleCardContextMenu(node, e)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
