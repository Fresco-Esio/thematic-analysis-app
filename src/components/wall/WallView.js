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
 * Dragging: pointer capture on the card, 3px threshold, positions tracked in
 * local state during the drag, ONE `UPDATE_NODE {wallPosition}` dispatch on
 * release (non-undoable — wallPosition is in POSITION_ONLY_KEYS). A card
 * dragged out of the tray must NOT move between React parents mid-drag
 * (unmounting would break pointer capture), so the tray card stays mounted
 * and a non-interactive ghost follows the cursor on the wall instead.
 *
 * Shares `id="canvas-export-target"` with Canvas so PNG/PDF export works on
 * whichever view is mounted (only one renders at a time).
 */

import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { useGraph, useGraphDispatch } from '../../context/GraphContext';
import WallCard from './WallCard';
import WallRegion from './WallRegion';

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
  const { nodes, regions } = useGraph();
  const dispatch = useGraphDispatch();

  const surfaceRef = useRef(null);
  const layerRef = useRef(null);
  const zoomTransformRef = useRef({ x: 0, y: 0, k: 1 });
  // { nodeId, startX, startY, moved, fromTray, lastPos } — lastPos is the drop
  // position source of truth (state below is only for rendering and may lag
  // a frame behind the pointer)
  const dragStateRef = useRef(null);
  // Live positions during a drag (id → world {x, y}); cleared on release
  const [dragPositions, setDragPositions] = useState(() => new Map());

  // ── Pan/zoom (d3.zoom on the surface div — no simulation, no tick loop) ──
  useEffect(() => {
    if (!surfaceRef.current) return;

    const surface = d3.select(surfaceRef.current);
    const zoomBehavior = d3.zoom()
      .scaleExtent([MIN_ZOOM, MAX_ZOOM])
      // Cards and region chrome live INSIDE the zoom target, so their drags
      // must not also pan the wall (d3's default filter only checks buttons).
      .filter((event) => {
        if (event.target.closest?.('[data-card-id], [data-region-drag]')) return false;
        return (!event.ctrlKey || event.type === 'wheel') && !event.button;
      })
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

  // ── Card drag handlers ────────────────────────────────────────────────────
  function clientToWorld(clientX, clientY) {
    const rect = surfaceRef.current.getBoundingClientRect();
    const { x: tx, y: ty, k } = zoomTransformRef.current;
    return { x: (clientX - rect.left - tx) / k, y: (clientY - rect.top - ty) / k };
  }

  function handleCardPointerDown(node, e) {
    if (e.button !== 0) return;
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic/lost pointer */ }
    const startPos = resolveWallPosition(node);
    const startWorld = clientToWorld(e.clientX, e.clientY);
    dragStateRef.current = {
      nodeId: node.id,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      fromTray: startPos === null,
      // keep the grab point under the cursor instead of snapping the center
      offset: startPos
        ? { x: startPos.x - startWorld.x, y: startPos.y - startWorld.y }
        : { x: 0, y: 0 },
    };
  }

  function handleCardPointerMove(node, e) {
    const ds = dragStateRef.current;
    if (!ds || ds.nodeId !== node.id || !(e.buttons & 1)) return;

    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;
    if (!ds.moved && Math.hypot(dx, dy) > 3) ds.moved = true;
    if (!ds.moved) return;

    // A tray card only materialises on the wall once the pointer crosses the
    // tray's right edge (= the surface's left edge).
    if (ds.fromTray && surfaceRef.current) {
      const surfRect = surfaceRef.current.getBoundingClientRect();
      if (e.clientX < surfRect.left) {
        ds.lastPos = null;
        setDragPositions(prev => {
          if (!prev.has(node.id)) return prev;
          const next = new Map(prev);
          next.delete(node.id);
          return next;
        });
        return;
      }
    }

    const world = clientToWorld(e.clientX, e.clientY);
    const pos = { x: world.x + ds.offset.x, y: world.y + ds.offset.y };
    ds.lastPos = pos;
    setDragPositions(prev => {
      const next = new Map(prev);
      next.set(node.id, pos);
      return next;
    });
  }

  function handleCardPointerUp(node, e) {
    const ds = dragStateRef.current;
    if (!ds || ds.nodeId !== node.id) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* synthetic/lost pointer */ }
    dragStateRef.current = null;
    if (!ds.moved) return;

    const dropPos = ds.lastPos;
    setDragPositions(prev => {
      if (!prev.has(node.id)) return prev;
      const next = new Map(prev);
      next.delete(node.id);
      return next;
    });
    if (!dropPos) return; // tray drag released before reaching the wall

    dispatch({ type: 'UPDATE_NODE', id: node.id, changes: { wallPosition: dropPos } });
  }

  // ── Derived render sets ───────────────────────────────────────────────────
  const codeNodes = nodes.filter(n => n.type === 'code');
  const trayNodes = codeNodes.filter(n => !n.primaryThemeId && !n.wallPosition);
  const wallCards = codeNodes
    .map(n => ({ node: n, position: dragPositions.get(n.id) ?? resolveWallPosition(n) }))
    .filter(c => c.position !== null && !(trayNodes.includes(c.node)));
  // Ghost for a tray card mid-drag (the tray card itself stays mounted so it
  // keeps pointer capture)
  const ghost = dragStateRef.current?.fromTray && dragPositions.has(dragStateRef.current.nodeId)
    ? { node: nodes.find(n => n.id === dragStateRef.current.nodeId), position: dragPositions.get(dragStateRef.current.nodeId) }
    : null;

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
        {trayNodes.length === 0 && (
          <span style={{ fontSize: 12, color: '#6b6560', fontStyle: 'italic' }}>
            Nothing waiting — new codes without a theme land here.
          </span>
        )}
        {trayNodes.map(node => {
          const draggingOut = dragPositions.has(node.id);
          return (
            <div key={node.id} style={{ opacity: draggingOut ? 0.25 : 1 }}>
              <WallCard
                node={node}
                inTray
                onPointerDown={(e) => handleCardPointerDown(node, e)}
                onPointerMove={(e) => handleCardPointerMove(node, e)}
                onPointerUp={(e) => handleCardPointerUp(node, e)}
                onContextMenu={(e) => handleCardContextMenu(node, e)}
              />
            </div>
          );
        })}
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
          {/* Theme regions — beneath the cards */}
          {(regions || []).map(region => {
            const theme = nodes.find(n => n.id === region.themeId);
            if (!theme) return null;
            return (
              <WallRegion
                key={region.id}
                region={region}
                color={theme.color || '#6b7280'}
                label={theme.label || 'Untitled Theme'}
                zoomK={() => zoomTransformRef.current.k}
                onCommitRect={(rect) => dispatch({ type: 'UPDATE_REGION', id: region.id, changes: { rect } })}
                onContextMenu={(x, y) => onContextMenu?.('theme', region.themeId, x, y)}
              />
            );
          })}
          {wallCards.map(({ node, position }) => (
            <WallCard
              key={node.id}
              node={node}
              position={position}
              onPointerDown={(e) => handleCardPointerDown(node, e)}
              onPointerMove={(e) => handleCardPointerMove(node, e)}
              onPointerUp={(e) => handleCardPointerUp(node, e)}
              onContextMenu={(e) => handleCardContextMenu(node, e)}
            />
          ))}
          {ghost && (
            <div style={{ pointerEvents: 'none', opacity: 0.85 }}>
              <WallCard node={ghost.node} position={ghost.position} />
            </div>
          )}
        </div>

        {/* Usage hint — shown until the wall has content */}
        {wallCards.length === 0 && (regions || []).length === 0 && !ghost && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              pointerEvents: 'none',
              padding: 24,
              gap: 12,
            }}
          >
            <p style={{
              fontSize: 13, fontWeight: 800, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: '#dc2626', margin: 0,
            }}>
              The research wall
            </p>
            <p style={{ fontSize: 28, fontWeight: 800, color: '#0f0d0a', margin: 0, maxWidth: '24ch', lineHeight: 1.15 }}>
              Sort codes by placing cards
            </p>
            <p style={{ fontSize: 16, color: '#6b6560', margin: 0, maxWidth: '48ch', lineHeight: 1.5 }}>
              <strong style={{ color: '#0f0d0a' }}>＋ Add Theme</strong> puts a theme region on the wall.
              Drag a card from the <strong style={{ color: '#0f0d0a' }}>UNSORTED</strong> tray into a region
              to assign it to that theme; drag it out again to unassign.
              Scroll to zoom, drag empty wall to pan, right-click anything for actions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
