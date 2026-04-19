/**
 * Canvas.js
 * ──────────────────────────────────────────────────────────────────────────
 * Main visualization container for the thematic analysis graph.
 *
 * Responsibilities:
 *   1. Host the D3 force simulation (singleton per app)
 *   2. Render React nodes positioned by simulation
 *   3. Render SVG layer for edges and hover tooltips
 *   4. Manage pan/zoom via D3 zoom behavior
 *   5. Handle node drag, edge connection mode, and canvas interactions
 *
 * KEY DESIGN:
 *   - D3 simulation mutates node objects in-place (adds x, y, vx, vy)
 *   - Canvas re-renders on every tick to show live positions
 *   - SVG edges update synchronously with node positions
 *   - GraphNode component accepts Framer Motion drag props
 *   - Connection mode: click one code node, then another to create edge
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { createSimulation } from '../utils/forceSimulation';
import { useGraph, useGraphDispatch } from '../context/GraphContext';
import GraphNode from './nodes/GraphNode';
import { getNodeRadius } from '../utils/nodeUtils';
import { getEdgeDashArray, getEdgeStrokeWidth } from '../utils/edgeTypes';
import QuoteTooltip from './QuoteTooltip';
import './Canvas.css';

// ── Canvas Constants ──────────────────────────────────────────────────────────

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const TOOLTIP_OFFSET = 12; // pixels from mouse

// ── useCanvasState Hook ───────────────────────────────────────────────────────

/**
 * Manages all canvas-specific UI state (pan/zoom, tooltips, connection mode).
 *
 * Returns:
 *   {
 *     zoomTransform: { x, y, k },
 *     setZoomTransform: fn,
 *     hoveredNodeId: string | null,
 *     setHoveredNodeId: fn,
 *     connectingFrom: { nodeId, x, y } | null,
 *     setConnectingFrom: fn,
 *     activeEdgeId: string | null,
 *     setActiveEdgeId: fn,
 *     tooltipPos: { x, y },
 *     setTooltipPos: fn,
 *   }
 */
function useCanvasState() {
  const [zoomTransform, setZoomTransform] = useState({ x: 0, y: 0, k: 1 });
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [activeEdgeId, setActiveEdgeId] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  return {
    zoomTransform,
    setZoomTransform,
    hoveredNodeId,
    setHoveredNodeId,
    connectingFrom,
    setConnectingFrom,
    activeEdgeId,
    setActiveEdgeId,
    tooltipPos,
    setTooltipPos,
  };
}

// ── useDragAndSimulation Hook ─────────────────────────────────────────────────

/**
 * Initialize D3 simulation, manage node drag, and clean up on unmount.
 *
 * Behavior:
 *   - Init: Call createSimulation once on mount
 *   - Drag: call simulation.pinNode(nodeId) on drag start
 *   - End: call simulation.releaseNode(nodeId) on drag end
 *   - Cleanup: call simulation.destroy() on unmount
 *
 * @param {Array} nodes - node array from GraphContext
 * @param {Array} edges - edge array from GraphContext
 * @param {fn} onTick - callback when simulation updates
 * @returns { simulation: ref, positions: Map<id, {x,y}> }
 */
function useDragAndSimulation(nodes, edges, onTick, physicsParams) {
  const simulationRef = useRef(null);
  const positionsRef = useRef(new Map());

  useEffect(() => {
    const sim = createSimulation(nodes, edges, (simNodes) => {
      // Sync simulated positions into our map
      simNodes.forEach(n => {
        positionsRef.current.set(n.id, { x: n.x, y: n.y });
      });
      onTick();
    }, physicsParams);

    simulationRef.current = sim;

    return () => {
      if (simulationRef.current) {
        simulationRef.current.destroy();
        simulationRef.current = null;
      }
    };
    // Simulation is intentionally created once; graph updates flow through updateData.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update simulation data when nodes/edges change
  useEffect(() => {
    if (simulationRef.current && (nodes.length > 0 || edges.length > 0)) {
      simulationRef.current.updateData(nodes, edges);
    }
  }, [nodes, edges]);

  useEffect(() => {
    if (simulationRef.current && physicsParams) {
      simulationRef.current.updateParams(physicsParams);
    }
  }, [physicsParams]);

  return { simulation: simulationRef, positions: positionsRef };
}

// ── Canvas Component ──────────────────────────────────────────────────────────

/**
 * Main Canvas component.
 *
 * PROPS:
 *   connectionMode {boolean}      - true when user is in edge creation mode
 *   readOnly       {boolean}      - (optional) prevent drag/create operations
 *   onEdgeClick    {fn}           - (optional) called when edge is clicked
 *   onNodeClick    {fn}           - (optional) called when node is clicked
 */
export default function Canvas({
  connectMode = false,
  physicsParams,
  onContextMenu,
  onFitReady,
  onAlignReady,
  onZoomReady,
  searchQuery = '',
  searchFilters = { themes: true, codes: true },
  focusThemeId = null,
  onExitFocus,
  collapsedNodeIds = new Set(),
}) {
  const graphState = useGraph();
  const dispatch = useGraphDispatch();
  const canvasState = useCanvasState();
  const { simulation, positions } = useDragAndSimulation(
    graphState.nodes,
    graphState.edges,
    () => setForceRender(f => !f), // Force re-render on tick
    physicsParams
  );

  // Force re-render on simulation tick
  const [, setForceRender] = useState(false);

  const svgRef = useRef(null);
  const nodesContainerRef = useRef(null);
  const zoomTransformRef = useRef({ x: 0, y: 0, k: 1 });
  // Tracks the node being dragged via pointer events
  const dragStateRef = useRef(null); // { nodeId, startX, startY, moved }
  const zoomBehaviorRef = useRef(null);

  // ── Initialization & Zoom Setup ───────────────────────────────────

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    // Create and attach zoom behavior
    const zoomBehavior = d3.zoom()
      .scaleExtent([MIN_ZOOM, MAX_ZOOM])
      .on('zoom', (event) => {
        const t = { x: event.transform.x, y: event.transform.y, k: event.transform.k };
        canvasState.setZoomTransform(t);
        zoomTransformRef.current = t;

        // Apply transform to nodes container
        if (nodesContainerRef.current) {
          nodesContainerRef.current.style.transform =
            `translate(${event.transform.x}px, ${event.transform.y}px) scale(${event.transform.k})`;
        }

        // Apply transform to the edges group only (not nested <g> wrappers)
        svg.select('#edges').attr('transform', event.transform);
      });

    zoomBehaviorRef.current = zoomBehavior;
    svg.call(zoomBehavior);

    // Cleanup
    return () => {
      svg.on('.zoom', null);
    };
  }, [canvasState]);

  // ── Mouse Move Handler (update tooltip & connecting line) ────────────────

  const handleCanvasMouseMove = useCallback((e) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    canvasState.setTooltipPos({
      x: mouseX + TOOLTIP_OFFSET,
      y: mouseY + TOOLTIP_OFFSET,
    });
  }, [canvasState]);

  // ── Mouse Leave Handler (clear hover & connection) ────────────────────

  const handleCanvasMouseLeave = useCallback(() => {
    canvasState.setHoveredNodeId(null);
    canvasState.setConnectingFrom(null);
  }, [canvasState]);

  // ── Pointer Drag Handlers (replace Framer Motion drag) ───────────────

  const handleNodePointerDown = useCallback((nodeId, e) => {
    if (connectMode) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = { nodeId, startX: e.clientX, startY: e.clientY, moved: false };
    if (simulation.current) {
      const pos = positions.current.get(nodeId);
      if (pos) simulation.current.pinNode(nodeId, pos.x, pos.y);
    }
  }, [connectMode, simulation, positions]);

  const handleNodePointerMove = useCallback((nodeId, e) => {
    const ds = dragStateRef.current;
    if (!ds || ds.nodeId !== nodeId || !(e.buttons & 1)) return;

    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;
    if (!ds.moved && Math.hypot(dx, dy) > 3) ds.moved = true;
    if (!ds.moved) return;

    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !simulation.current) return;
    const { x: tx, y: ty, k } = zoomTransformRef.current;
    simulation.current.pinNode(nodeId,
      (e.clientX - rect.left - tx) / k,
      (e.clientY - rect.top - ty) / k,
    );
  }, [simulation]);

  const handleNodePointerUp = useCallback((nodeId, e) => {
    const ds = dragStateRef.current;
    if (!ds || ds.nodeId !== nodeId) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const wasDrag = ds.moved;
    dragStateRef.current = null;

    if (wasDrag && simulation.current) {
      simulation.current.releaseNode(nodeId);
      const pos = positions.current.get(nodeId);
      if (pos) dispatch({ type: 'UPDATE_NODE', id: nodeId, changes: { x: pos.x, y: pos.y } });
    }
  }, [simulation, positions, dispatch]);

  // ── CodeNode Event Handlers ───────────────────────────────────────────

  const handleCodeNodeMouseEnter = useCallback((nodeId) => {
    canvasState.setHoveredNodeId(nodeId);
  }, [canvasState]);

  const handleCodeNodeMouseLeave = useCallback(() => {
    canvasState.setHoveredNodeId(null);
  }, [canvasState]);

  const handleCodeNodeClick = useCallback((nodeId) => {
    if (!connectMode) return; // Normal mode: left-click does nothing; use right-click
    // Connect mode: code nodes are sources
    if (!canvasState.connectingFrom) {
      const pos = positions.current.get(nodeId) || { x: 0, y: 0 };
      canvasState.setConnectingFrom({ nodeId, x: pos.x, y: pos.y });
    } else if (canvasState.connectingFrom.nodeId === nodeId) {
      canvasState.setConnectingFrom(null); // cancel: clicked same node
    }
  }, [connectMode, canvasState, positions]);

  const handleThemeNodeClick = useCallback((nodeId) => {
    if (!connectMode || !canvasState.connectingFrom) return;
    // Connect mode: theme nodes are targets
    const sourceNode = graphState.nodes.find(n => n.id === canvasState.connectingFrom.nodeId);
    const targetNode = graphState.nodes.find(n => n.id === nodeId);
    if (sourceNode && targetNode && sourceNode.type === 'code' && targetNode.type === 'theme') {
      const edgeId = `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      dispatch({ type: 'ADD_EDGE', edge: { id: edgeId, source: sourceNode.id, target: targetNode.id } });
      canvasState.setConnectingFrom(null);
    }
  }, [connectMode, canvasState, graphState.nodes, dispatch]);

  // ── Edge Event Handlers ───────────────────────────────────────────────

  const handleEdgeMouseEnter = useCallback((edgeId) => {
    canvasState.setActiveEdgeId(edgeId);
  }, [canvasState]);

  const handleEdgeMouseLeave = useCallback(() => {
    canvasState.setActiveEdgeId(null);
  }, [canvasState]);

  const handleEdgeClick = useCallback((edgeId, e) => {
    onContextMenu('edge', edgeId, e?.clientX ?? 0, e?.clientY ?? 0);
  }, [onContextMenu]);

  // ── ThemeNode Mouse Handlers ───────────────────────────────────────────

  const handleThemeNodeMouseEnter = useCallback((nodeId) => {
    canvasState.setHoveredNodeId(nodeId);
  }, [canvasState]);

  const handleThemeNodeMouseLeave = useCallback(() => {
    canvasState.setHoveredNodeId(null);
  }, [canvasState]);

  // ── Fit to View ───────────────────────────────────────────────────────────

  const fitToView = useCallback(() => {
    if (!zoomBehaviorRef.current || !svgRef.current) return;

    const svgEl = svgRef.current;
    const width  = svgEl.clientWidth;
    const height = svgEl.clientHeight;
    if (width === 0 || height === 0) return;

    // Build bounding box from all node positions using per-node radius
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    graphState.nodes.forEach(node => {
      const pos    = positions.current.get(node.id) ?? { x: node.x ?? 0, y: node.y ?? 0 };
      const radius = getNodeRadius(node);
      minX = Math.min(minX, pos.x - radius);
      minY = Math.min(minY, pos.y - radius);
      maxX = Math.max(maxX, pos.x + radius);
      maxY = Math.max(maxY, pos.y + radius);
    });

    if (!isFinite(minX)) return; // no nodes

    const PADDING = 80;
    minX -= PADDING; minY -= PADDING;
    maxX += PADDING; maxY += PADDING;

    const bboxW = maxX - minX;
    const bboxH = maxY - minY;
    const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(width / bboxW, height / bboxH)));

    const tx = width  / 2 - ((minX + maxX) / 2) * scale;
    const ty = height / 2 - ((minY + maxY) / 2) * scale;

    const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);
    d3.select(svgEl)
      .transition().duration(600)
      .call(zoomBehaviorRef.current.transform, transform);
  }, [graphState.nodes, positions]);

  const fitToViewRef = useRef(fitToView);
  useEffect(() => { fitToViewRef.current = fitToView; }, [fitToView]);

  // Expose fitToView to parent on mount
  useEffect(() => {
    if (onFitReady) onFitReady(() => fitToViewRef.current());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expose zoomBy to parent on mount
  useEffect(() => {
    if (onZoomReady) {
      onZoomReady((factor) => {
        if (!zoomBehaviorRef.current || !svgRef.current) return;
        d3.select(svgRef.current)
          .transition().duration(250)
          .call(zoomBehaviorRef.current.scaleBy, factor);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expose align reheat to parent on mount
  useEffect(() => {
    if (onAlignReady) {
      onAlignReady(() => {
        if (simulation.current) {
          simulation.current.alpha(0.5).restart();
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-fit once on open when nodes exist
  const hasAutoFitted = useRef(false);
  useEffect(() => {
    if (hasAutoFitted.current || graphState.nodes.length === 0) return;
    hasAutoFitted.current = true;
    const timer = setTimeout(() => fitToViewRef.current(), 500);
    return () => clearTimeout(timer);
  }, [graphState.nodes.length]); // re-check when node count changes (first load)

  // ── Focus View Logic ──────────────────────────────────────────────────────

  const focusedNodeIds = useMemo(() => {
    if (!focusThemeId) return new Set();

    const edges = graphState.edges;
    const nodes = graphState.nodes;

    // Direct neighbours of the theme
    const directNeighbours = edges
      .filter(e => e.source === focusThemeId || e.target === focusThemeId)
      .map(e => e.source === focusThemeId ? e.target : e.source);

    // Subtheme neighbours → also include their code connections
    const subthemeIds = directNeighbours.filter(id => {
      const n = nodes.find(nd => nd.id === id);
      return n?.type === 'subtheme';
    });

    const subthemeNeighbours = subthemeIds.flatMap(stId =>
      edges
        .filter(e => e.source === stId || e.target === stId)
        .map(e => e.source === stId ? e.target : e.source)
    );

    return new Set([focusThemeId, ...directNeighbours, ...subthemeNeighbours]);
  }, [focusThemeId, graphState.edges, graphState.nodes]);

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && focusThemeId) {
        onExitFocus?.();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusThemeId, onExitFocus]);

  // Zoom-to-cluster effect
  useEffect(() => {
    if (!focusThemeId || !zoomBehaviorRef.current || !svgRef.current) return;

    const focusedNodes = graphState.nodes.filter(n => focusedNodeIds.has(n.id));
    if (focusedNodes.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    focusedNodes.forEach(node => {
      const pos      = positions.current.get(node.id) ?? { x: node.x ?? 0, y: node.y ?? 0 };
      const halfSize = getNodeRadius(node);
      minX = Math.min(minX, pos.x - halfSize);
      minY = Math.min(minY, pos.y - halfSize);
      maxX = Math.max(maxX, pos.x + halfSize);
      maxY = Math.max(maxY, pos.y + halfSize);
    });

    const PADDING = 80;
    const svgEl = svgRef.current;
    const W = svgEl.clientWidth  || 800;
    const H = svgEl.clientHeight || 600;
    const contentW = maxX - minX + 2 * PADDING;
    const contentH = maxY - minY + 2 * PADDING;
    const k = Math.min(W / contentW, H / contentH, MAX_ZOOM);
    const tx = W / 2 - k * ((minX + maxX) / 2);
    const ty = H / 2 - k * ((minY + maxY) / 2);

    d3.select(svgEl)
      .transition()
      .duration(600)
      .ease(d3.easeCubicInOut)
      .call(zoomBehaviorRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
  }, [focusThemeId, focusedNodeIds, graphState.nodes]);

  // ── Search Logic ──────────────────────────────────────────────────────────

  const searchActive = searchQuery.trim().length > 0;

  const matchedNodeIds = useMemo(() => {
    if (!searchActive) return new Set();
    const lowerQuery = searchQuery.toLowerCase().trim();
    return new Set(
      graphState.nodes
        .filter(n => {
          const typeMatch =
            (n.type === 'theme'    && searchFilters.themes) ||
            (n.type === 'subtheme' && searchFilters.subthemes) ||
            (n.type === 'code'     && searchFilters.codes);
          return typeMatch && (n.label || '').toLowerCase().includes(lowerQuery);
        })
        .map(n => n.id)
    );
  }, [graphState.nodes, searchQuery, searchFilters, searchActive]);

  // ── Collapsed Code IDs ───────────────────────────────────────────────

  const collapsedCodeIds = useMemo(() => {
    const ids = new Set();
    collapsedNodeIds.forEach(collapsedId => {
      graphState.edges.forEach(e => {
        if (e.source !== collapsedId && e.target !== collapsedId) return;
        const codeId = e.source === collapsedId ? e.target : e.source;
        const codeNode = graphState.nodes.find(nd => nd.id === codeId);
        if (codeNode?.type === 'code') ids.add(codeId);
      });
    });
    return ids;
  }, [collapsedNodeIds, graphState.nodes, graphState.edges]);

  // ── Edge List (Memoized) ──────────────────────────────────────────────

  const edgeListMemo = useMemo(() => {
    return (graphState.edges || []).map(edge => {
      const sourceNode = graphState.nodes.find(n => n.id === edge.source);
      const targetNode = graphState.nodes.find(n => n.id === edge.target);
      return { edge, sourceNode, targetNode };
    }).filter(({ sourceNode, targetNode }) => sourceNode && targetNode);
  }, [graphState.edges, graphState.nodes]);

  // ── Get Node Position   ───────────────────────────────────────────────

  const getNodePos = useCallback((nodeId) => {
    const pos = positions.current.get(nodeId);
    if (pos) return pos;

    const node = graphState.nodes.find(n => n.id === nodeId);
    return node && node.x !== undefined && node.y !== undefined
      ? { x: node.x, y: node.y }
      : { x: 0, y: 0 };
  }, [graphState.nodes, positions]);

  // ── Tooltip Visibility ───────────────────────────────────────────────

  const showTooltip = canvasState.hoveredNodeId &&
    !canvasState.connectingFrom;

  const hoveredCodeNode = showTooltip
    ? graphState.nodes.find(n => n.id === canvasState.hoveredNodeId)
    : null;

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div
      id="canvas-export-target"
      className="canvas-container"
      style={{
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--bg-canvas)',
      }}
      onMouseMove={handleCanvasMouseMove}
      onMouseLeave={handleCanvasMouseLeave}
    >
      {/* SVG Layer (edges, connecting line) */}
      <svg
        id="canvas-svg"
        ref={svgRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'auto',
        }}
      >
        {/* Edges group */}
        <g id="edges">
          {edgeListMemo.map(({ edge, sourceNode, targetNode }) => {
            const { x: x1, y: y1 } = getNodePos(sourceNode.id);
            const { x: x2, y: y2 } = getNodePos(targetNode.id);

            const isActive = canvasState.activeEdgeId === edge.id;
            const strokeColor = edge.color || (targetNode.color || '#64748b');
            const dashArray = getEdgeDashArray(edge.relationType);
            const strokeWidth = isActive ? 7 : getEdgeStrokeWidth(edge.relationType);
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            const hasLabel = !!edge.label;
            const labelChars = (edge.label || '').length;
            const labelWidth = labelChars * 6.5 + 8;
            const labelHeight = 16;

            const isEdgeCollapsed = collapsedCodeIds.has(edge.source) || collapsedCodeIds.has(edge.target);
            return (
              <g key={edge.id} style={{ opacity: isEdgeCollapsed ? 0 : 1, transition: 'opacity 0.3s ease' }}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={dashArray || undefined}
                  style={{
                    cursor: 'pointer',
                    transition: 'stroke-width 150ms ease',
                    opacity: isActive ? 1 : 0.6,
                  }}
                  onMouseEnter={() => handleEdgeMouseEnter(edge.id)}
                  onMouseLeave={() => handleEdgeMouseLeave()}
                  onClick={(e) => handleEdgeClick(edge.id, e)}
                />
                {hasLabel && (
                  <g style={{ pointerEvents: 'none' }}>
                    <rect
                      x={mx - labelWidth / 2}
                      y={my - labelHeight / 2}
                      width={labelWidth}
                      height={labelHeight}
                      fill="#f0ebe3"
                      rx={0}
                    />
                    <text
                      x={mx}
                      y={my + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={strokeColor}
                      fontSize={10}
                      fontWeight={700}
                      fontFamily='"Bricolage Grotesque", sans-serif'
                      style={{
                        textDecoration: isActive ? 'underline' : 'none',
                        textDecorationColor: '#dc2626',
                      }}
                    >
                      {edge.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* Connecting line — screen-space, direct SVG child (no zoom transform applied) */}
        {canvasState.connectingFrom && (() => {
          const { x: tx, y: ty, k } = zoomTransformRef.current;
          // Convert source from world → screen space
          const sx = canvasState.connectingFrom.x * k + tx;
          const sy = canvasState.connectingFrom.y * k + ty;
          // Target is already screen-space (mouse position, no offset)
          const ex = canvasState.tooltipPos.x - TOOLTIP_OFFSET;
          const ey = canvasState.tooltipPos.y - TOOLTIP_OFFSET;
          return (
            <line
              x1={sx}
              y1={sy}
              x2={ex}
              y2={ey}
              stroke="#64748b"
              strokeDasharray="4,4"
              strokeWidth={2}
              opacity={0.7}
              pointerEvents="none"
            />
          );
        })()}
      </svg>

      {/* React Nodes Layer */}
      <div
        ref={nodesContainerRef}
        className="nodes-layer"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          transformOrigin: '0 0',
          transition: 'none',
        }}
      >
        {/* All nodes rendered as GraphNode */}
        {(() => {
          // Build collapse lookup Maps once, outside the node loop
          // collapsingPositionMap: codeId → parent {x,y} (for 'collapsed' variant fly-to)
          // dotCodeIds: Set of codeIds whose parent is a theme (use 'dot' variant — stay in place)
          const collapsingPositionMap = new Map();
          const dotCodeIds = new Set();
          collapsedCodeIds.forEach(codeId => {
            const parentEdge = graphState.edges.find(e => {
              const otherId = e.source === codeId ? e.target : (e.target === codeId ? e.source : null);
              return otherId != null && collapsedNodeIds.has(otherId);
            });
            if (parentEdge) {
              const parentId = parentEdge.source === codeId ? parentEdge.target : parentEdge.source;
              collapsingPositionMap.set(codeId, getNodePos(parentId));
              const parentNode = graphState.nodes.find(n => n.id === parentId);
              if (parentNode?.type === 'theme') dotCodeIds.add(codeId);
            }
          });

          return (graphState.nodes || []).map((node) => {
          const pos = getNodePos(node.id);
          const isConnecting = canvasState.connectingFrom?.nodeId === node.id;
          const isSelected = canvasState.hoveredNodeId === node.id && connectMode;

          // Route clicks based on node type (code → source, theme → target in connect mode)
          const handleClick = () => {
            if (node.type === 'code') {
              handleCodeNodeClick(node.id);
            } else {
              handleThemeNodeClick(node.id);
            }
          };

          // Route context menu based on node type
          const handleContextMenu = (e) => {
            e.preventDefault();
            onContextMenu(node.type, node.id, e.clientX, e.clientY);
          };

          // Route mouse events based on node type
          const handleMouseEnter = () => {
            if (node.type === 'code') {
              handleCodeNodeMouseEnter(node.id);
            } else {
              handleThemeNodeMouseEnter(node.id);
            }
          };

          const handleMouseLeave = () => {
            if (node.type === 'code') {
              handleCodeNodeMouseLeave();
            } else {
              handleThemeNodeMouseLeave();
            }
          };

          // Collapse props
          const isCollapsed = collapsedCodeIds.has(node.id) && !dotCodeIds.has(node.id);
          const isDot = dotCodeIds.has(node.id);
          const collapsingIntoPosition = isCollapsed ? (collapsingPositionMap.get(node.id) ?? null) : null;
          // Badge only shows on subthemes — only compute count for them
          const collapsedCodeCount = node.type === 'subtheme'
            ? graphState.edges.filter(e => {
                const otherId = e.source === node.id ? e.target : e.target === node.id ? e.source : null;
                return otherId && collapsedCodeIds.has(otherId);
              }).length
            : 0;

          return (
            <GraphNode
              key={node.id}
              node={node}
              position={pos}
              isSelected={isSelected}
              isConnecting={isConnecting}
              connectMode={connectMode}
              focusThemeId={focusThemeId}
              focusedNodeIds={focusedNodeIds}
              searchActive={searchActive}
              isSearchMatch={matchedNodeIds.has(node.id)}
              isCollapsed={isCollapsed}
              isDot={isDot}
              collapsingIntoPosition={collapsingIntoPosition}
              collapsedCodeCount={collapsedCodeCount}
              onClick={handleClick}
              onContextMenu={handleContextMenu}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onPointerDown={(e) => handleNodePointerDown(node.id, e)}
              onPointerMove={(e) => handleNodePointerMove(node.id, e)}
              onPointerUp={(e) => handleNodePointerUp(node.id, e)}
            />
          );
          });
        })()}
      </div>

      {/* Exit Focus pill */}
      {focusThemeId && (
        <button
          onClick={onExitFocus}
          aria-label="Exit focus view"
          style={{
            position:        'absolute',
            bottom:          24,
            left:            '50%',
            transform:       'translateX(-50%)',
            zIndex:          40,
            backgroundColor: '#0f0d0a',
            color:           'white',
            border:          '2px solid white',
            boxShadow:       '4px 4px 0 #dc2626',
            padding:         '8px 20px',
            fontWeight:      700,
            fontSize:        16,
            cursor:          'pointer',
            borderRadius:    4,
          }}
        >
          ✕ Exit Focus
        </button>
      )}

      {/* Quote Tooltip */}
      <QuoteTooltip
        visible={showTooltip}
        x={canvasState.tooltipPos.x}
        y={canvasState.tooltipPos.y}
        code={hoveredCodeNode?.label || ''}
        quote={hoveredCodeNode?.quote || ''}
        source={hoveredCodeNode?.source || ''}
        color={hoveredCodeNode?.color || '#64748b'}
      />
    </div>
  );
}
