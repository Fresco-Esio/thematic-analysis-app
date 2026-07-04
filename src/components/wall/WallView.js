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
import { cardRect, assignmentAfterDrop, isContested, clusterPiles, stringAnchorOnRegion } from '../../utils/wallGeometry';
import { getEdgeDashArray, getEdgeStrokeWidth } from '../../utils/edgeTypes';
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

export default function WallView({ onContextMenu, onCropRectReady }) {
  const { nodes, edges, regions } = useGraph();
  const dispatch = useGraphDispatch();

  const surfaceRef = useRef(null);
  const layerRef = useRef(null);
  const zoomTransformRef = useRef({ x: 0, y: 0, k: 1 });
  // { nodeId, startX, startY, moved, fromTray, lastPos } — lastPos is the drop
  // position source of truth (state below is only for rendering and may lag
  // a frame behind the pointer)
  const dragStateRef = useRef(null);
  // Pending keyboard move: { nodeId, pos } — committed on keyup
  const keyMoveRef = useRef(null);
  // Live positions during a drag (id → world {x, y}); cleared on release
  const [dragPositions, setDragPositions] = useState(() => new Map());
  // Ids of the pile currently fanned out (cleared on next wall click)
  const [fannedIds, setFannedIds] = useState(null);

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

  // Expose a world-rect → element-relative crop converter for region export
  // (App feeds the result to exportRegionToPng against #canvas-export-target)
  useEffect(() => {
    onCropRectReady?.((rect, pad = 24) => {
      const { x: tx, y: ty, k } = zoomTransformRef.current;
      return {
        x: TRAY_W + tx + (rect.x - pad) * k,
        y: ty + (rect.y - pad) * k,
        w: (rect.w + pad * 2) * k,
        h: (rect.h + pad * 2) * k,
      };
    });
    return () => onCropRectReady?.(null);
  }, [onCropRectReady]);

  // ── Card drag handlers ────────────────────────────────────────────────────
  function clientToWorld(clientX, clientY) {
    const rect = surfaceRef.current.getBoundingClientRect();
    const { x: tx, y: ty, k } = zoomTransformRef.current;
    return { x: (clientX - rect.left - tx) / k, y: (clientY - rect.top - ty) / k };
  }

  function handleCardPointerDown(node, e, renderPos) {
    if (e.button !== 0) return;
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic/lost pointer */ }
    // renderPos (e.g. a fanned pile member's offset spot) is where the user
    // actually grabbed the card — offset from there, not the stored position
    const startPos = renderPos ?? resolveWallPosition(node);
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

    commitDrop(node, dropPos);
  }

  /**
   * Persist a card's position and apply placement-as-assignment: an
   * unambiguous drop into a region assigns the code to that theme; a drop
   * onto empty wall unassigns. BULK_ASSIGN_THEME already sets
   * primaryThemeId + color and creates the edge — reuse it.
   */
  function commitDrop(node, dropPos) {
    dispatch({ type: 'UPDATE_NODE', id: node.id, changes: { wallPosition: dropPos } });
    const decision = assignmentAfterDrop(cardRect(dropPos), regions || [], node.primaryThemeId);
    if (decision.assignTo) {
      dispatch({ type: 'BULK_ASSIGN_THEME', nodeIds: [node.id], targetId: decision.assignTo });
    } else if (decision.unassign) {
      dispatch({ type: 'UNASSIGN_CODE', id: node.id });
    }
  }

  // ── Keyboard: arrows move a wall card (8px, 1px with Shift), committed on
  // keyup; Enter/Space opens the context menu at the card center (same
  // synthetic pattern as GraphNode) ─────────────────────────────────────────
  function handleCardKeyDown(node, renderPos, e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      onContextMenu?.('code', node.id, rect.left + rect.width / 2, rect.top + rect.height / 2);
      return;
    }
    const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const dir = ARROWS[e.key];
    if (!dir || !renderPos) return; // tray cards don't move by keyboard
    e.preventDefault();
    e.stopPropagation();
    const step = e.shiftKey ? 1 : 8;
    const cur = keyMoveRef.current?.nodeId === node.id ? keyMoveRef.current.pos : renderPos;
    const pos = { x: cur.x + dir[0] * step, y: cur.y + dir[1] * step };
    keyMoveRef.current = { nodeId: node.id, pos };
    setDragPositions(prev => new Map(prev).set(node.id, pos));
  }

  function handleCardKeyUp(node, e) {
    const km = keyMoveRef.current;
    if (!km || km.nodeId !== node.id) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    keyMoveRef.current = null;
    setDragPositions(prev => {
      if (!prev.has(node.id)) return prev;
      const next = new Map(prev);
      next.delete(node.id);
      return next;
    });
    commitDrop(node, km.pos);
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

  // ── Piles — derived, never stored. Cards stacked within 28px cluster; the
  // top card carries a count badge that fans the pile out for grabbing.
  // The actively dragged card is excluded so passing over a pile is inert.
  const pileMeta = new Map(); // id → { size, isTop, rotate, fanOffset, ids }
  const pileables = wallCards.filter(c => !dragPositions.has(c.node.id));
  clusterPiles(pileables.map(c => ({ id: c.node.id, x: c.position.x, y: c.position.y }))).forEach(ids => {
    if (ids.length < 2) return;
    const fanned = !!fannedIds && ids.some(id => fannedIds.includes(id));
    ids.forEach((id, i) => {
      const isTop = i === ids.length - 1;
      pileMeta.set(id, {
        size: ids.length,
        isTop,
        rotate: fanned || isTop ? 0 : ((i % 3) - 1) * 2.5,
        fanOffset: fanned ? { x: i * 24, y: i * 24 } : null,
        ids,
      });
    });
  });

  // Final on-screen position per card (drag + fan offsets applied) — shared
  // by the card layer and the string-edge endpoints
  const cardPosById = new Map();
  wallCards.forEach(({ node, position }) => {
    const meta = pileMeta.get(node.id);
    cardPosById.set(node.id, meta?.fanOffset
      ? { x: position.x + meta.fanOffset.x, y: position.y + meta.fanOffset.y }
      : position);
  });

  /**
   * String terminal: card center for codes ({pos}), region rect for themes
   * ({rect} — the actual anchor point is resolved against the other end so
   * strings attach to the nearest border, clear of the label plate).
   */
  function edgeTerminal(nodeId) {
    if (cardPosById.has(nodeId)) return { pos: cardPosById.get(nodeId) };
    const node = nodes.find(n => n.id === nodeId);
    if (node?.type === 'theme') {
      const region = (regions || []).find(r => r.themeId === nodeId);
      if (region) return { rect: region.rect };
    }
    return null; // tray code, missing region, or subtheme — no string
  }

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
                onKeyDown={(e) => handleCardKeyDown(node, null, e)}
              />
            </div>
          );
        })}
      </div>

      {/* Wall surface — pan/zoom plane */}
      <div
        ref={surfaceRef}
        data-testid="wall-surface"
        onClick={(e) => {
          // Next wall click collapses any fanned pile
          if (fannedIds && !e.target.closest('[data-card-id]')) setFannedIds(null);
        }}
        style={{ position: 'relative', flex: 1, overflow: 'hidden', cursor: 'grab' }}
      >
        <div
          ref={layerRef}
          style={{ position: 'absolute', top: 0, left: 0, transformOrigin: '0 0' }}
        >
          {/* Theme regions — bottom layer */}
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

          {/* String edges — over the regions, under the cards */}
          <svg
            data-testid="wall-strings"
            style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 1, overflow: 'visible', pointerEvents: 'none' }}
          >
            {edges.map(edge => {
              const s = edgeTerminal(edge.source);
              const t = edgeTerminal(edge.target);
              if (!s || !t) return null;
              const rectCenter = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
              const p1 = s.pos ?? stringAnchorOnRegion(s.rect, t.pos ?? rectCenter(t.rect));
              const p2 = t.pos ?? stringAnchorOnRegion(t.rect, p1);
              const targetNode = nodes.find(n => n.id === edge.target);
              const strokeColor = edge.color || targetNode?.color || '#64748b';
              // Control point sags below the chord like a pinned string
              const midX = (p1.x + p2.x) / 2;
              const midY = (p1.y + p2.y) / 2 + Math.hypot(p2.x - p1.x, p2.y - p1.y) * 0.08;
              // Curve point at t=0.5 — where the label sits
              const labelX = (p1.x + 2 * midX + p2.x) / 4;
              const labelY = (p1.y + 2 * midY + p2.y) / 4;
              const labelChars = (edge.label || '').length;
              const labelWidth = labelChars * 6.5 + 8;
              return (
                <g key={edge.id}>
                  <path
                    d={`M ${p1.x} ${p1.y} Q ${midX} ${midY} ${p2.x} ${p2.y}`}
                    stroke={strokeColor}
                    strokeWidth={getEdgeStrokeWidth(edge.relationType)}
                    strokeDasharray={getEdgeDashArray(edge.relationType) || undefined}
                    fill="none"
                    strokeLinecap="round"
                    opacity={0.55}
                  />
                  {/* Wide transparent hit path → relationship menu */}
                  <path
                    d={`M ${p1.x} ${p1.y} Q ${midX} ${midY} ${p2.x} ${p2.y}`}
                    stroke="transparent"
                    strokeWidth={16}
                    fill="none"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); onContextMenu?.('edge', edge.id, e.clientX, e.clientY); }}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu?.('edge', edge.id, e.clientX, e.clientY); }}
                  />
                  {edge.label && (
                    <g style={{ pointerEvents: 'none' }}>
                      <rect x={labelX - labelWidth / 2} y={labelY - 8} width={labelWidth} height={16} fill="#f0ebe3" />
                      <text
                        x={labelX}
                        y={labelY + 1}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={strokeColor}
                        fontSize={10}
                        fontWeight={700}
                        fontFamily='"Bricolage Grotesque", sans-serif'
                      >
                        {edge.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {wallCards.map(({ node, position }) => {
            const meta = pileMeta.get(node.id);
            const renderPos = meta?.fanOffset
              ? { x: position.x + meta.fanOffset.x, y: position.y + meta.fanOffset.y }
              : position;
            return (
              <WallCard
                key={node.id}
                node={node}
                position={renderPos}
                contested={isContested(cardRect(renderPos), regions || [])}
                rotate={meta?.rotate || 0}
                pileCount={meta && meta.isTop && !meta.fanOffset ? meta.size : 0}
                onPileClick={() => setFannedIds(meta.ids)}
                onPointerDown={(e) => handleCardPointerDown(node, e, renderPos)}
                onPointerMove={(e) => handleCardPointerMove(node, e)}
                onPointerUp={(e) => handleCardPointerUp(node, e)}
                onContextMenu={(e) => handleCardContextMenu(node, e)}
                onKeyDown={(e) => handleCardKeyDown(node, renderPos, e)}
                onKeyUp={(e) => handleCardKeyUp(node, e)}
              />
            );
          })}
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
