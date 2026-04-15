/**
 * forceSimulation.js
 * ──────────────────────────────────────────────────────────────────────────
 * Creates and manages a D3 force simulation for the thematic analysis graph.
 *
 * KEY DESIGN:
 *   - D3 mutates node objects in-place (adds .x, .y, .vx, .vy)
 *   - We pass the same node/edge arrays from React state
 *   - On each tick, we call onTick() so Canvas.js can re-render
 *   - Physics params come from localStorage (PhysicsPanel saves them)
 *
 * USAGE:
 *   const sim = createSimulation(nodes, edges, onTick, params);
 *   sim.updateData(newNodes, newEdges); // when graph changes
 *   sim.updateParams(newParams);         // when sliders change
 *   sim.pinNode(id, x, y);              // during drag
 *   sim.releaseNode(id);                // after drag
 *   sim.destroy();                      // on component unmount
 */

import * as d3 from 'd3';

/** Default physics parameters */
export const DEFAULT_PHYSICS = {
  linkDistance:    180,  // px between connected nodes
  repulsion:       -300, // negative = repulsion
  collisionRadius: 80,   // minimum distance between node centers
  linkStrength:    0.4,  // how strongly edges pull nodes together (0–1)
  velocityDecay:   0.4,  // how quickly nodes slow down (0–1)
};

const PHYSICS_STORAGE_KEY = 'thematic_analysis_physics_v1';

/** Load physics params from localStorage (or return defaults) */
export function loadPhysicsParams() {
  try {
    const saved = localStorage.getItem(PHYSICS_STORAGE_KEY);
    if (saved) return { ...DEFAULT_PHYSICS, ...JSON.parse(saved) };
  } catch (e) { /* ignore */ }
  return { ...DEFAULT_PHYSICS };
}

/** Save physics params to localStorage */
export function savePhysicsParams(params) {
  try {
    localStorage.setItem(PHYSICS_STORAGE_KEY, JSON.stringify(params));
  } catch (e) { /* ignore */ }
}

/**
 * Create and start a D3 force simulation.
 *
 * @param {Array}    nodes   — node objects from GraphContext (will be mutated by D3)
 * @param {Array}    edges   — edge objects from GraphContext
 * @param {Function} onTick  — called every simulation tick; triggers React re-render
 * @param {Object}   params  — physics parameters (use loadPhysicsParams() for defaults)
 * @returns simulation controller object
 */
export function createSimulation(nodes, edges, onTick, params = DEFAULT_PHYSICS) {
  // D3 needs mutable copies of the data arrays (it adds vx, vy etc.)
  // We keep a reference so we can update them later
  let simNodes = nodes.map(n => ({ ...n }));
  let simEdges = edges.map(e => ({ source: e.source, target: e.target, id: e.id }));

  const sim = d3.forceSimulation(simNodes)
    .force('charge',  d3.forceManyBody().strength(params.repulsion))
    .force('link',    d3.forceLink(simEdges)
                        .id(d => d.id)
                        .distance(params.linkDistance)
                        .strength(params.linkStrength))
    .force('collide', d3.forceCollide(params.collisionRadius).strength(0.7))
    .force('center',  d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2).strength(0.03))
    .velocityDecay(params.velocityDecay)
    .alphaDecay(0.01)   // slow cooling so the graph stays lively
    .on('tick', () => onTick(simNodes, simEdges));

  return {
    /**
     * Called when nodes or edges change in GraphContext.
     * Restarts the simulation with updated data.
     */
    updateData(newNodes, newEdges) {
      // Preserve existing positions
      const posMap = {};
      simNodes.forEach(n => { posMap[n.id] = { x: n.x, y: n.y }; });

      simNodes = newNodes.map(n => ({
        ...n,
        x: posMap[n.id]?.x ?? n.x ?? window.innerWidth  / 2 + (Math.random() - 0.5) * 100,
        y: posMap[n.id]?.y ?? n.y ?? window.innerHeight / 2 + (Math.random() - 0.5) * 100,
      }));

      simEdges = newEdges.map(e => ({ source: e.source, target: e.target, id: e.id }));

      sim.nodes(simNodes);
      sim.force('link').links(simEdges);
      sim.alpha(0.3).restart();
    },

    /** Update physics parameters (from PhysicsPanel sliders) */
    updateParams(newParams) {
      sim.force('charge').strength(newParams.repulsion);
      sim.force('link').distance(newParams.linkDistance).strength(newParams.linkStrength);
      sim.force('collide').radius(newParams.collisionRadius);
      sim.velocityDecay(newParams.velocityDecay);
      sim.alpha(0.3).restart();
    },

    /** Pin a node at fixed coordinates during drag */
    pinNode(id, x, y) {
      const node = simNodes.find(n => n.id === id);
      if (node) { node.fx = x; node.fy = y; }
    },

    /** Release a dragged node (let simulation take over) */
    releaseNode(id) {
      const node = simNodes.find(n => n.id === id);
      if (node) { node.fx = null; node.fy = null; }
    },

    /** Get current simulated positions (to sync back to React) */
    getPositions() {
      const pos = {};
      simNodes.forEach(n => { pos[n.id] = { x: n.x, y: n.y }; });
      return pos;
    },

    /** Stop simulation and clean up */
    destroy() {
      sim.stop();
    },
  };
}
