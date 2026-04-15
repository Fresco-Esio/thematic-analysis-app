/**
 * App.js
 * ──────────────────────────────────────────────────────────────────────────
 * Root component. Wires together all components:
 *   - GraphProvider (state)
 *   - Toolbar (top actions)
 *   - Canvas (the main graph)
 *   - PhysicsPanel (collapsible sidebar)
 *   - All modals (Import, CodeEdit, ThemeEdit)
 *   - ContextMenu (right-click)
 *
 * State managed here:
 *   - connectMode:   toolbar toggle
 *   - physicsOpen:   sidebar toggle
 *   - physicsParams: passed to Canvas + PhysicsPanel
 *   - modal state:   which modal is open + which node
 *   - contextMenu:   position + items
 */

import React, { useState, useRef } from 'react';
import { GraphProvider, useGraphDispatch, useGraph, makeId, UNASSIGNED_COLOR } from './context/GraphContext';
import { loadPhysicsParams } from './utils/forceSimulation';
import { exportToPng, exportToPdf } from './utils/exportUtils';
import Canvas       from './components/Canvas';
import Toolbar      from './components/Toolbar';
import PhysicsPanel from './components/PhysicsPanel';
import ImportModal  from './components/modals/ImportModal';
import CodeEditModal  from './components/modals/CodeEditModal';
import ThemeEditModal from './components/modals/ThemeEditModal';
import ContextMenu  from './components/ContextMenu';

// ── Inner app (needs access to GraphContext hooks) ────────────────────────────
function AppInner() {
  const dispatch = useGraphDispatch();
  const { nodes, edges } = useGraph();
  const canvasRef = useRef(null);
  const fitViewFn = useRef(null);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [connectMode,   setConnectMode]   = useState(false);
  const [physicsOpen,   setPhysicsOpen]   = useState(false);
  const [physicsParams, setPhysicsParams] = useState(loadPhysicsParams);

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [importOpen,     setImportOpen]     = useState(false);
  const [codeEditId,     setCodeEditId]     = useState(null);
  const [themeEditId,    setThemeEditId]    = useState(null);

  // ── Context menu ────────────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState({ visible: false, x: 0, y: 0, items: [] });

  // ── Toolbar actions ─────────────────────────────────────────────────────────

  function handleAddTheme() {
    const cx = window.innerWidth  / 2 + (Math.random() - 0.5) * 200;
    const cy = window.innerHeight / 2 + (Math.random() - 0.5) * 200;
    dispatch({
      type: 'ADD_NODE',
      node: { id: makeId('theme'), type: 'theme', label: 'New Theme', color: '#6366f1', x: cx, y: cy },
    });
  }

  function handleAddCode() {
    const cx = window.innerWidth  / 2 + (Math.random() - 0.5) * 200;
    const cy = window.innerHeight / 2 + (Math.random() - 0.5) * 200;
    dispatch({
      type: 'ADD_NODE',
      node: { id: makeId('code'), type: 'code', label: 'New Code', quote: '', source: '', primaryThemeId: null, color: UNASSIGNED_COLOR, x: cx, y: cy },
    });
  }

  function handleClear() {
    if (window.confirm('Clear the entire canvas? This cannot be undone.')) {
      dispatch({ type: 'CLEAR' });
    }
  }

  async function handleExportPng() {
    const el = document.getElementById('canvas-export-target');
    if (el) await exportToPng(el);
  }

  async function handleExportPdf() {
    const el = document.getElementById('canvas-export-target');
    if (el) await exportToPdf(el);
  }

  // ── Context menu handler (from Canvas) ──────────────────────────────────────
  function handleContextMenu(type, id, x, y) {
    let items = [];

    if (type === 'code-edit' || type === 'code') {
      items = [
        { label: '✏ Rename / Edit Code',  action: () => setCodeEditId(id) },
        { label: '✕ Delete Node',         action: () => dispatch({ type: 'DELETE_NODE', id }), danger: true },
      ];
    } else if (type === 'theme-edit' || type === 'theme') {
      items = [
        { label: '✏ Rename / Edit Theme', action: () => setThemeEditId(id) },
        { label: '✕ Delete Theme', action: () => {
            const connectedCount = edges.filter(e => e.target === id).length;
            const msg = connectedCount > 0
              ? `Delete theme? ${connectedCount} code node(s) will become unassigned.`
              : 'Delete this theme?';
            if (window.confirm(msg)) dispatch({ type: 'DELETE_NODE', id });
          }, danger: true },
      ];
    } else if (type === 'edge') {
      items = [
        { label: '✕ Remove Connection', action: () => dispatch({ type: 'DELETE_EDGE', id }), danger: true },
      ];
    }

    if (items.length > 0) {
      setCtxMenu({ visible: true, x, y, items });
    }
  }

  // ── Status bar counts ────────────────────────────────────────────────────────
  const codeCount      = nodes.filter(n => n.type === 'code').length;
  const themeCount     = nodes.filter(n => n.type === 'theme').length;
  const unassignedCount = nodes.filter(n => n.type === 'code' && !n.primaryThemeId).length;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden">

      <Toolbar
        connectMode={connectMode}
        physicsOpen={physicsOpen}
        onImport={() => setImportOpen(true)}
        onAddTheme={handleAddTheme}
        onAddCode={handleAddCode}
        onToggleConnect={() => setConnectMode(m => !m)}
        onFitView={() => fitViewFn.current?.()}
        onExportPng={handleExportPng}
        onExportPdf={handleExportPdf}
        onTogglePhysics={() => setPhysicsOpen(o => !o)}
        onClear={handleClear}
      />

      <div className="flex flex-1 overflow-hidden" ref={canvasRef}>
        <Canvas
          connectMode={connectMode}
          physicsParams={physicsParams}
          onContextMenu={handleContextMenu}
          onFitReady={(fn) => { fitViewFn.current = fn; }}
        />
        <PhysicsPanel
          open={physicsOpen}
          params={physicsParams}
          onChange={setPhysicsParams}
          onClose={() => setPhysicsOpen(false)}
        />
      </div>

      {/* Status bar */}
      <div className="flex gap-6 px-4 py-2 bg-slate-800 border-t border-slate-700 text-base text-slate-500">
        <span><b className="text-slate-200">{codeCount}</b> codes</span>
        <span><b className="text-slate-200">{themeCount}</b> themes</span>
        <span><b className="text-slate-400">{unassignedCount}</b> unassigned</span>
      </div>

      {/* Modals */}
      <ImportModal    open={importOpen}    onClose={() => setImportOpen(false)} />
      <CodeEditModal  nodeId={codeEditId}  onClose={() => setCodeEditId(null)} />
      <ThemeEditModal nodeId={themeEditId} onClose={() => setThemeEditId(null)} />

      {/* Context menu */}
      <ContextMenu
        visible={ctxMenu.visible}
        x={ctxMenu.x}
        y={ctxMenu.y}
        items={ctxMenu.items}
        onClose={() => setCtxMenu(m => ({ ...m, visible: false }))}
      />
    </div>
  );
}

// ── Root export wraps AppInner in the GraphProvider ───────────────────────────
export default function App() {
  return (
    <GraphProvider>
      <AppInner />
    </GraphProvider>
  );
}