/**
 * GraphContext.js
 * ──────────────────────────────────────────────────────────────────────────
 * Central state store for the thematic analysis graph.
 *
 * STATE SHAPE:
 *   nodes  — array of { id, type, label, x, y, ...typeSpecificFields }
 *   edges  — array of { id, source, target }
 *
 * NODE TYPES:
 *   "theme" — { id, type:"theme", label, color, x, y }
 *   "code"  — { id, type:"code",  label, quote, source, primaryThemeId, color, x, y }
 *
 * ACTIONS (dispatched via useGraphDispatch):
 *   ADD_NODES     { nodes: Node[] }           — bulk add (used by import)
 *   ADD_NODE      { node: Node }              — single add
 *   UPDATE_NODE   { id, changes: Partial<Node> }
 *   DELETE_NODE   { id }                      — also removes all edges touching that node
 *   ADD_EDGE      { edge: Edge }
 *   DELETE_EDGE   { id }
 *   SET_GRAPH     { nodes, edges }            — full replace (used by localStorage restore)
 *   CLEAR         {}                          — wipe everything
 */

import React, { createContext, useContext, useReducer, useEffect } from 'react';

// ── Constants ────────────────────────────────────────────────────────────────

/** 14-color accessible palette, auto-assigned to themes on import */
export const THEME_PALETTE = [
  '#4f46e5', // indigo
  '#0891b2', // cyan
  '#dc2626', // red
  '#059669', // emerald
  '#d97706', // amber
  '#7c3aed', // violet
  '#db2777', // pink
  '#0284c7', // sky
  '#16a34a', // green
  '#ea580c', // orange
  '#0d9488', // teal
  '#9333ea', // purple
  '#ca8a04', // yellow
  '#475569', // slate (fallback)
];

/** Gray color for unassigned code nodes */
export const UNASSIGNED_COLOR = '#6b7280';

const STORAGE_KEY = 'thematic_analysis_graph_v1';

// ── Initial state ─────────────────────────────────────────────────────────────

const initialState = {
  nodes: [],
  edges: [],
};

// ── Reducer ───────────────────────────────────────────────────────────────────

export function graphReducer(state, action) {
  switch (action.type) {

    case 'ADD_NODES': {
      // Merge new nodes; skip duplicates by id
      const existingIds = new Set(state.nodes.map(n => n.id));
      const fresh = action.nodes.filter(n => !existingIds.has(n.id));
      return { ...state, nodes: [...state.nodes, ...fresh] };
    }

    case 'ADD_NODE': {
      const exists = state.nodes.some(n => n.id === action.node.id);
      if (exists) return state;
      return { ...state, nodes: [...state.nodes, action.node] };
    }

    case 'UPDATE_NODE': {
      return {
        ...state,
        nodes: state.nodes.map(n =>
          n.id === action.id ? { ...n, ...action.changes } : n
        ),
      };
    }

    case 'DELETE_NODE': {
      const nodeToDelete = state.nodes.find(n => n.id === action.id);
      const isThemeNode = nodeToDelete?.type === 'theme';

      // Remove node and all edges that reference it.
      // If a theme is deleted, any code that uses it as its primary theme
      // must be returned to the unassigned state.
      return {
        nodes: state.nodes
          .filter(n => n.id !== action.id)
          .map(n => {
            if (isThemeNode && n.type === 'code' && n.primaryThemeId === action.id) {
              return { ...n, primaryThemeId: null, color: UNASSIGNED_COLOR };
            }
            return n;
          }),
        edges: state.edges.filter(
          e => e.source !== action.id && e.target !== action.id
        ),
      };
    }

    case 'ADD_EDGE': {
      // Prevent duplicate edges
      const dup = state.edges.some(
        e => e.source === action.edge.source && e.target === action.edge.target
      );
      if (dup) return state;

      // Update primaryThemeId on the code node if it doesn't have one yet
      const codeNode = state.nodes.find(n => n.id === action.edge.source);
      const themeNode = state.nodes.find(n => n.id === action.edge.target);
      let updatedNodes = state.nodes;

      if (codeNode && themeNode && !codeNode.primaryThemeId) {
        updatedNodes = state.nodes.map(n =>
          n.id === codeNode.id
            ? { ...n, primaryThemeId: themeNode.id, color: themeNode.color }
            : n
        );
      }

      return {
        nodes: updatedNodes,
        edges: [...state.edges, action.edge],
      };
    }

    case 'DELETE_EDGE': {
      const edge = state.edges.find(e => e.id === action.id);
      if (!edge) return state;

      const remainingEdges = state.edges.filter(e => e.id !== action.id);

      // If this was the primary theme edge for the code node, promote the next one or revert to unassigned
      const codeNode = state.nodes.find(n => n.id === edge.source);
      let updatedNodes = state.nodes;

      if (codeNode && codeNode.primaryThemeId === edge.target) {
        // Find next remaining edge from this code node
        const nextEdge = remainingEdges.find(e => e.source === codeNode.id);
        if (nextEdge) {
          const nextTheme = state.nodes.find(n => n.id === nextEdge.target);
          if (nextTheme) {
            updatedNodes = state.nodes.map(n =>
              n.id === codeNode.id
                ? { ...n, primaryThemeId: nextTheme.id, color: nextTheme.color }
                : n
            );
          } else {
            // nextEdge exists but target theme is gone — revert to unassigned
            updatedNodes = state.nodes.map(n =>
              n.id === codeNode.id
                ? { ...n, primaryThemeId: null, color: UNASSIGNED_COLOR }
                : n
            );
          }
        } else {
          // No more connections — revert to unassigned
          updatedNodes = state.nodes.map(n =>
            n.id === codeNode.id
              ? { ...n, primaryThemeId: null, color: UNASSIGNED_COLOR }
              : n
          );
        }
      }

      return { nodes: updatedNodes, edges: remainingEdges };
    }

    case 'SET_GRAPH':
      return { nodes: action.nodes, edges: action.edges };

    case 'CLEAR':
      return { nodes: [], edges: [] };

    default:
      return state;
  }
}

// ── Context setup ─────────────────────────────────────────────────────────────

const GraphStateContext    = createContext(null);
const GraphDispatchContext = createContext(null);

export function GraphProvider({ children }) {
  // Restore persisted state synchronously via lazy initializer so the very
  // first render already has the saved graph and the save effect never
  // overwrites localStorage with an empty state.
  const [state, dispatch] = useReducer(graphReducer, initialState, () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.nodes && parsed.edges) {
          return { nodes: parsed.nodes, edges: parsed.edges };
        }
      }
    } catch (e) {
      console.warn('Failed to restore graph from localStorage:', e);
    }
    return initialState;
  });

  // Save to localStorage on every state change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save graph to localStorage:', e);
    }
  }, [state]);

  return (
    <GraphStateContext.Provider value={state}>
      <GraphDispatchContext.Provider value={dispatch}>
        {children}
      </GraphDispatchContext.Provider>
    </GraphStateContext.Provider>
  );
}

/** Hook: access the full graph state */
export function useGraph() {
  const ctx = useContext(GraphStateContext);
  if (!ctx) throw new Error('useGraph must be used inside <GraphProvider>');
  return ctx;
}

/** Hook: access the dispatch function to mutate state */
export function useGraphDispatch() {
  const ctx = useContext(GraphDispatchContext);
  if (!ctx) throw new Error('useGraphDispatch must be used inside <GraphProvider>');
  return ctx;
}

/**
 * Helper: generate a stable unique ID for a new node.
 * Format: "<type>-<timestamp>-<4-char-random>"
 */
export function makeId(type) {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
