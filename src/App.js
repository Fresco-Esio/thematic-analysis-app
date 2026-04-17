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
import SubthemeEditModal from './components/modals/SubthemeEditModal';
import ContextMenu  from './components/ContextMenu';
import EdgeRelationshipPanel from './components/EdgeRelationshipPanel';

// ── Inner app (needs access to GraphContext hooks) ────────────────────────────
function AppInner() {
  const dispatch = useGraphDispatch();
  const { nodes, edges } = useGraph();
  const canvasRef = useRef(null);
  const fitViewFn = useRef(null);
  const alignTriggerRef = useRef(null);
  const zoomByFn = useRef(null);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [connectMode,   setConnectMode]   = useState(false);
  const [physicsOpen,   setPhysicsOpen]   = useState(false);
  const [physicsParams, setPhysicsParams] = useState(loadPhysicsParams);

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [importOpen,     setImportOpen]     = useState(false);
  const [codeEditId,     setCodeEditId]     = useState(null);
  const [themeEditId,    setThemeEditId]    = useState(null);
  const [subthemeEditId, setSubthemeEditId] = useState(null);
  const [edgeEditId,      setEdgeEditId]      = useState(null);
  const [edgePanelAnchor, setEdgePanelAnchor] = useState({ x: 0, y: 0 });

  // ── Focus view ──────────────────────────────────────────────────────────────
  const [focusThemeId, setFocusThemeId] = useState(null);

  // ── Context menu ────────────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState({ visible: false, x: 0, y: 0, items: [] });

  // ── Search state
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchFilters, setSearchFilters] = useState({ themes: true, codes: true });

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

  function handleAddSubtheme() {
    const cx = window.innerWidth  / 2 + (Math.random() - 0.5) * 200;
    const cy = window.innerHeight / 2 + (Math.random() - 0.5) * 200;
    dispatch({
      type: 'ADD_NODE',
      node: { id: makeId('subtheme'), type: 'subtheme', label: 'New Subtheme', primaryThemeId: null, color: UNASSIGNED_COLOR, x: cx, y: cy },
    });
  }

  function handleClear() {
    if (window.confirm('Clear the entire canvas? This cannot be undone.')) {
      dispatch({ type: 'CLEAR' });
    }
  }

  function handleAlign() {
    const themeNodes = nodes.filter(n => n.type === 'theme');
    const codeNodes  = nodes.filter(n => n.type === 'code');
    const cx = window.innerWidth  / 2;
    const cy = window.innerHeight / 2;
    const themeRingR = Math.max(300, themeNodes.length * 80);

    // 1. Theme nodes on outer ring
    themeNodes.forEach((theme, i) => {
      const angle = (2 * Math.PI * i) / themeNodes.length - Math.PI / 2;
      dispatch({ type: 'UPDATE_NODE', id: theme.id, changes: {
        x: cx + Math.cos(angle) * themeRingR,
        y: cy + Math.sin(angle) * themeRingR,
      }});
    });

    // 2. Code nodes in sub-rings around their theme
    themeNodes.forEach((theme, ti) => {
      const themeAngle = (2 * Math.PI * ti) / themeNodes.length - Math.PI / 2;
      const themeX     = cx + Math.cos(themeAngle) * themeRingR;
      const themeY     = cy + Math.sin(themeAngle) * themeRingR;
      const connected  = codeNodes.filter(n => n.primaryThemeId === theme.id);
      const codeRingR  = 120 + connected.length * 12;
      connected.forEach((code, ci) => {
        const codeAngle = (2 * Math.PI * ci) / connected.length - Math.PI / 2;
        dispatch({ type: 'UPDATE_NODE', id: code.id, changes: {
          x: themeX + Math.cos(codeAngle) * codeRingR,
          y: themeY + Math.sin(codeAngle) * codeRingR,
        }});
      });
    });

    // 3. Unassigned codes at canvas center
    const unassigned = codeNodes.filter(n => !n.primaryThemeId);
    unassigned.forEach((code, i) => {
      const angle = (2 * Math.PI * i) / Math.max(unassigned.length, 1) - Math.PI / 2;
      dispatch({ type: 'UPDATE_NODE', id: code.id, changes: {
        x: cx + Math.cos(angle) * 80,
        y: cy + Math.sin(angle) * 80,
      }});
    });

    // 4. Reheat simulation
    alignTriggerRef.current?.();
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
        { label: '⊙ Focus View', action: () => setFocusThemeId(id) },
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
        { label: '✎ Edit Relationship', action: () => { setEdgeEditId(id); setEdgePanelAnchor({ x, y }); } },
        { label: '✕ Remove Connection', action: () => dispatch({ type: 'DELETE_EDGE', id }), danger: true },
      ];
    }

    if (items.length > 0) {
      setCtxMenu({ visible: true, x, y, items });
    }
  }

  function handleEdgeRelationshipApply(relationType, label) {
    if (!edgeEditId) return;
    dispatch({ type: 'UPDATE_EDGE', id: edgeEditId, changes: { relationType, label } });
  }

  // ── Status bar counts ────────────────────────────────────────────────────────
  const codeCount      = nodes.filter(n => n.type === 'code').length;
  const themeCount     = nodes.filter(n => n.type === 'theme').length;
  const subthemeCount  = nodes.filter(n => n.type === 'subtheme').length;
  const unassignedCount = nodes.filter(n => n.type === 'code' && !n.primaryThemeId).length;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--text-primary)' }}>

      <Toolbar
        connectMode={connectMode}
        physicsOpen={physicsOpen}
        onImport={() => setImportOpen(true)}
        onAddTheme={handleAddTheme}
        onAddCode={handleAddCode}
        onAddSubtheme={handleAddSubtheme}
        onToggleConnect={() => setConnectMode(m => !m)}
        onFitView={() => fitViewFn.current?.()}
        onZoomIn={() => zoomByFn.current?.(1.4)}
        onZoomOut={() => zoomByFn.current?.(1 / 1.4)}
        onExportPng={handleExportPng}
        onExportPdf={handleExportPdf}
        onTogglePhysics={() => setPhysicsOpen(o => !o)}
        onAlign={handleAlign}
        onClear={handleClear}
        searchOpen={searchOpen}
        searchQuery={searchQuery}
        searchFilters={searchFilters}
        onSearchToggle={() => { setSearchOpen(o => !o); if (searchOpen) setSearchQuery(''); }}
        onSearchChange={setSearchQuery}
        onSearchFilterChange={(key) => setSearchFilters(f => ({ ...f, [key]: !f[key] }))}
      />

      <div className="flex flex-1 overflow-hidden" ref={canvasRef}>
        <Canvas
          connectMode={connectMode}
          physicsParams={physicsParams}
          onContextMenu={handleContextMenu}
          onFitReady={(fn) => { fitViewFn.current = fn; }}
          onAlignReady={(fn) => { alignTriggerRef.current = fn; }}
          onZoomReady={(fn) => { zoomByFn.current = fn; }}
          searchQuery={searchQuery}
          searchFilters={searchFilters}
          focusThemeId={focusThemeId}
          onExitFocus={() => setFocusThemeId(null)}
        />
        <PhysicsPanel
          open={physicsOpen}
          params={physicsParams}
          onChange={setPhysicsParams}
          onClose={() => setPhysicsOpen(false)}
        />
      </div>

      {/* Status bar */}
      <div
        className="flex gap-6 px-4 py-2 border-t-2 text-base font-bold"
        style={{ backgroundColor: 'var(--bg-toolbar)', borderColor: '#dc2626', color: 'white' }}
      >
        <span>{themeCount} themes</span>
        <span>{subthemeCount} subthemes</span>
        <span>{codeCount} codes</span>
        <span style={{ color: '#dc2626' }}>{unassignedCount} unassigned</span>
      </div>

      {/* Modals */}
      <ImportModal    open={importOpen}    onClose={() => setImportOpen(false)} />
      <CodeEditModal  nodeId={codeEditId}  onClose={() => setCodeEditId(null)} />
      <ThemeEditModal nodeId={themeEditId} onClose={() => setThemeEditId(null)} />
      <SubthemeEditModal nodeId={subthemeEditId} onClose={() => setSubthemeEditId(null)} />

      {/* Edge relationship panel */}
      <EdgeRelationshipPanel
        edge={edges.find(e => e.id === edgeEditId) ?? null}
        anchorX={edgePanelAnchor.x}
        anchorY={edgePanelAnchor.y}
        onClose={() => setEdgeEditId(null)}
        onApply={handleEdgeRelationshipApply}
      />

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