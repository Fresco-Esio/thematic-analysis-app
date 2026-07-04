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
 *   "theme"    — { id, type:"theme",    label, color, x, y }
 *   "code"     — { id, type:"code",     label, quote, source, primaryThemeId, color, x, y }
 *   "subtheme" — { id, type:"subtheme", label, primaryThemeId, color, x, y }
 *
 * ACTIONS (dispatched via useGraphDispatch):
 *   ADD_NODES     { nodes: Node[] }           — bulk add (used by import)
 *   ADD_NODE      { node: Node }              — single add
 *   UPDATE_NODE   { id, changes: Partial<Node> }
 *   DELETE_NODE   { id }                      — also removes all edges touching that node
 *   ADD_EDGE      { edge: Edge }
 *   DELETE_EDGE   { id }
 *   UPDATE_EDGE   { id, changes: Partial<Edge> }
 *   SET_GRAPH     { nodes, edges }            — full replace (used by localStorage restore)
 *   CLEAR         {}                          — wipe everything
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';

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
      // Changing a theme's color cascades to its assigned codes/subthemes in
      // the same action, so undo/redo treats the recolor as one step.
      const target = state.nodes.find(n => n.id === action.id);
      const cascadeColor = target?.type === 'theme' && action.changes.color !== undefined
        ? action.changes.color
        : null;
      return {
        ...state,
        nodes: state.nodes.map(n => {
          if (n.id === action.id) return { ...n, ...action.changes };
          if (cascadeColor && (n.type === 'code' || n.type === 'subtheme') && n.primaryThemeId === action.id) {
            return { ...n, color: cascadeColor };
          }
          return n;
        }),
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
            if (isThemeNode && (n.type === 'code' || n.type === 'subtheme') && n.primaryThemeId === action.id) {
              return { ...n, primaryThemeId: null, color: UNASSIGNED_COLOR };
            }
            return n;
          }),
        edges: state.edges.filter(
          e => e.source !== action.id && e.target !== action.id
        ),
      };
    }

    case 'DELETE_NODES': {
      const idSet = new Set(action.ids);
      return {
        nodes: state.nodes
          .filter(n => !idSet.has(n.id))
          .map(n => {
            // If a deleted node was this node's primaryThemeId, revert to unassigned
            if (idSet.has(n.primaryThemeId)) {
              return { ...n, primaryThemeId: null, color: UNASSIGNED_COLOR };
            }
            return n;
          }),
        edges: state.edges.filter(e => !idSet.has(e.source) && !idSet.has(e.target)),
      };
    }

    case 'BULK_ASSIGN_THEME': {
      const targetNode = state.nodes.find(n => n.id === action.targetId);
      if (!targetNode) return state;

      const resolvedThemeId = targetNode.type === 'subtheme'
        ? targetNode.primaryThemeId
        : targetNode.id;
      const themeNode = state.nodes.find(n => n.id === resolvedThemeId);
      if (!themeNode) return state;

      const codeIdSet = new Set(action.nodeIds);

      const updatedNodes = state.nodes.map(n => {
        if (n.type !== 'code' || !codeIdSet.has(n.id)) return n;
        return { ...n, primaryThemeId: resolvedThemeId, color: themeNode.color };
      });

      const existingEdgePairs = new Set(state.edges.map(e => `${e.source}__${e.target}`));
      const newEdges = [];
      for (const codeId of action.nodeIds) {
        const codeNode = state.nodes.find(n => n.id === codeId && n.type === 'code');
        if (!codeNode) continue;
        const key = `${codeId}__${action.targetId}`;
        if (!existingEdgePairs.has(key)) {
          newEdges.push({ id: `edge-${codeId}-${action.targetId}`, source: codeId, target: action.targetId });
        }
      }

      return { nodes: updatedNodes, edges: [...state.edges, ...newEdges] };
    }

    case 'ADD_EDGE': {
      // Prevent duplicate edges
      const dup = state.edges.some(
        e => e.source === action.edge.source && e.target === action.edge.target
      );
      if (dup) return state;

      // Update primaryThemeId on the source node (code or subtheme) if it doesn't
      // have one yet. Edges to a subtheme resolve to the subtheme's parent theme.
      const sourceNode = state.nodes.find(n => n.id === action.edge.source);
      const targetNode = state.nodes.find(n => n.id === action.edge.target);
      let updatedNodes = state.nodes;

      if (sourceNode && targetNode && !sourceNode.primaryThemeId) {
        const resolvedThemeId = targetNode.type === 'theme'
          ? targetNode.id
          : (targetNode.type === 'subtheme' ? targetNode.primaryThemeId : null);
        const resolvedTheme = state.nodes.find(n => n.id === resolvedThemeId && n.type === 'theme');
        if (resolvedTheme) {
          updatedNodes = state.nodes.map(n =>
            n.id === sourceNode.id
              ? { ...n, primaryThemeId: resolvedTheme.id, color: resolvedTheme.color }
              : n
          );
        }
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

      // If this was the primary theme edge for the source node (code or subtheme), promote the next one or revert to unassigned
      const sourceNode = state.nodes.find(n => n.id === edge.source);
      let updatedNodes = state.nodes;

      if (sourceNode && sourceNode.primaryThemeId === edge.target) {
        // Find next remaining edge from this source node
        const nextEdge = remainingEdges.find(e => e.source === sourceNode.id);
        if (nextEdge) {
          const nextTheme = state.nodes.find(n => n.id === nextEdge.target);
          if (nextTheme) {
            updatedNodes = state.nodes.map(n =>
              n.id === sourceNode.id
                ? { ...n, primaryThemeId: nextTheme.id, color: nextTheme.color }
                : n
            );
          } else {
            // nextEdge exists but target theme is gone — revert to unassigned
            updatedNodes = state.nodes.map(n =>
              n.id === sourceNode.id
                ? { ...n, primaryThemeId: null, color: UNASSIGNED_COLOR }
                : n
            );
          }
        } else {
          // No more connections — revert to unassigned
          updatedNodes = state.nodes.map(n =>
            n.id === sourceNode.id
              ? { ...n, primaryThemeId: null, color: UNASSIGNED_COLOR }
              : n
          );
        }
      }

      return { nodes: updatedNodes, edges: remainingEdges };
    }

    case 'UPDATE_EDGE': {
      const exists = state.edges.some(e => e.id === action.id);
      if (!exists) return state;
      return {
        ...state,
        edges: state.edges.map(e =>
          e.id === action.id ? { ...e, ...action.changes } : e
        ),
      };
    }

    case 'SET_GRAPH':
      return { nodes: action.nodes, edges: action.edges };

    case 'CLEAR':
      return { nodes: [], edges: [] };

    default:
      return state;
  }
}

// ── History helpers ───────────────────────────────────────────────────────────

const POSITION_ONLY_KEYS = new Set(['x', 'y']);

function isUndoable(action) {
  if (action.type === 'SET_GRAPH') return false;
  if (action.type === 'UPDATE_NODE') {
    const keys = Object.keys(action.changes || {});
    return keys.some(k => !POSITION_ONLY_KEYS.has(k));
  }
  return true;
}

const MAX_HISTORY = 50;

function historyReducer(state, action) {
  // state = { past: [], present: {nodes,edges}, future: [] }
  if (action.type === 'UNDO') {
    if (state.past.length === 0) return state;
    const previous = state.past[state.past.length - 1];
    return {
      past:    state.past.slice(0, -1),
      present: previous,
      future:  [state.present, ...state.future].slice(0, MAX_HISTORY),
    };
  }
  if (action.type === 'REDO') {
    if (state.future.length === 0) return state;
    const next = state.future[0];
    return {
      past:    [...state.past, state.present].slice(-MAX_HISTORY),
      present: next,
      future:  state.future.slice(1),
    };
  }

  const nextPresent = graphReducer(state.present, action);
  if (nextPresent === state.present) return state; // no-op

  if (isUndoable(action)) {
    return {
      past:    [...state.past, state.present].slice(-MAX_HISTORY),
      present: nextPresent,
      future:  [],
    };
  }
  return { ...state, present: nextPresent };
}

// ── Context setup ─────────────────────────────────────────────────────────────

const GraphStateContext    = createContext(null);
const GraphDispatchContext = createContext(null);
const GraphHistoryContext  = createContext(null);

export function useGraphHistory() {
  const ctx = useContext(GraphHistoryContext);
  if (!ctx) throw new Error('useGraphHistory must be used inside <GraphProvider>');
  return ctx;
}

export function GraphProvider({ children }) {
  // Restore persisted state synchronously via lazy initializer so the very
  // first render already has the saved graph and the save effect never
  // overwrites localStorage with an empty state.
  const [state, dispatch] = useReducer(historyReducer, null, () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.nodes && parsed.edges) {
          return { past: [], present: { nodes: parsed.nodes, edges: parsed.edges }, future: [] };
        }
      }
    } catch (e) {
      console.warn('Failed to restore graph from localStorage:', e);
    }
    return { past: [], present: initialState, future: [] };
  });

  // Save to localStorage on every state change (present only — history is ephemeral)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.present));
    } catch (e) {
      console.warn('Failed to save graph to localStorage:', e);
    }
  }, [state.present]);

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

  return (
    <GraphStateContext.Provider value={state.present}>
      <GraphDispatchContext.Provider value={dispatch}>
        <GraphHistoryContext.Provider value={{ canUndo, canRedo, undo, redo }}>
          {children}
        </GraphHistoryContext.Provider>
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
