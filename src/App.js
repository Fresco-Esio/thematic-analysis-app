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

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GraphProvider, useGraphDispatch, useGraph, useGraphHistory, makeId, UNASSIGNED_COLOR } from './context/GraphContext';
import { loadPhysicsParams } from './utils/forceSimulation';
import { getMatchedNodeIds } from './utils/nodeUtils';
import { exportToPng, exportToPdf, exportRegionToPng } from './utils/exportUtils';
import Canvas       from './components/Canvas';
import WallView     from './components/wall/WallView';
import SankeyView   from './components/sankey/SankeyView';
import ReportView   from './components/report/ReportView';
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
  const { nodes, edges, regions } = useGraph();
  const { canUndo, canRedo, undo, redo } = useGraphHistory();
  const canvasRef = useRef(null);
  const fitViewFn = useRef(null);
  const alignTriggerRef = useRef(null);
  const zoomByFn = useRef(null);
  const screenToWorldRef = useRef(null);
  const wallCropRef = useRef(null); // WallView's world-rect → crop-rect converter

  // World coords of the visible viewport center — new nodes land where the
  // user is looking, even when panned/zoomed away from the origin.
  function viewportCenterWorld() {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const base = screenToWorldRef.current ? screenToWorldRef.current(cx, cy) : { x: cx, y: cy };
    return {
      x: base.x + (Math.random() - 0.5) * 200,
      y: base.y + (Math.random() - 0.5) * 200,
    };
  }

  // ── UI state ────────────────────────────────────────────────────────────────
  // Default stays 'graph'; flipping the default is a deliberate
  // post-validation follow-up (design doc §1).
  const [view,          setView]          = useState('graph'); // 'wall' | 'graph' | 'sankey' | 'report'
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

  // ── Collapsed nodes ─────────────────────────────────────────────────────────
  const [collapsedNodeIds, setCollapsedNodeIds] = useState(new Set());

  function toggleCollapse(nodeId) {
    setCollapsedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  // ── Multi-select state ──────────────────────────────────────────────────────
  const [selectedNodeIds, setSelectedNodeIds] = useState(new Set());

  function handleShiftClickNode(nodeId) {
    setSelectedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  function handleToggleConnect() {
    setConnectMode(prev => {
      if (!prev) setSelectedNodeIds(new Set()); // entering connect mode → clear selection
      return !prev;
    });
  }

  function handleSetFocusTheme(id) {
    setFocusThemeId(id);
    if (id) setSelectedNodeIds(new Set());
  }

  // ── Context menu ────────────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState({ visible: false, x: 0, y: 0, items: [] });

  // ── Search state
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchFilters, setSearchFilters] = useState({ themes: true, subthemes: true, codes: true });

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e) {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // ── Toolbar actions ─────────────────────────────────────────────────────────

  function handleAddTheme() {
    const { x: cx, y: cy } = viewportCenterWorld();
    const themeId = makeId('theme');
    dispatch({
      type: 'ADD_NODE',
      node: { id: themeId, type: 'theme', label: 'New Theme', color: '#6366f1', x: cx, y: cy, wallPosition: { x: cx, y: cy } },
    });
    // Every theme gets a territory on the Wall
    dispatch({ type: 'ADD_REGION', region: {
      id: `region-${themeId}`, themeId,
      rect: { x: cx - 220, y: cy - 160, w: 440, h: 320 },
    }});
  }

  function handleAddCode() {
    const { x: cx, y: cy } = viewportCenterWorld();
    dispatch({
      type: 'ADD_NODE',
      node: { id: makeId('code'), type: 'code', label: 'New Code', quote: '', source: '', primaryThemeId: null, color: UNASSIGNED_COLOR, x: cx, y: cy, wallPosition: { x: cx, y: cy } },
    });
  }

  function handleAddSubtheme() {
    const { x: cx, y: cy } = viewportCenterWorld();
    dispatch({
      type: 'ADD_NODE',
      node: { id: makeId('subtheme'), type: 'subtheme', label: 'New Subtheme', primaryThemeId: null, color: UNASSIGNED_COLOR, x: cx, y: cy, wallPosition: { x: cx, y: cy } },
    });
  }

  function handleClear() {
    if (window.confirm('Clear the entire canvas? (You can undo this with Ctrl+Z)')) {
      dispatch({ type: 'CLEAR' });
    }
  }

  function handleAlign() {
    const themeNodes    = nodes.filter(n => n.type === 'theme');
    const codeNodes     = nodes.filter(n => n.type === 'code');
    const subthemeNodes = nodes.filter(n => n.type === 'subtheme');
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

    // 1b. Subtheme nodes on a ring between theme and its codes
    themeNodes.forEach((theme, ti) => {
      const themeAngle = (2 * Math.PI * ti) / themeNodes.length - Math.PI / 2;
      const themeX = cx + Math.cos(themeAngle) * themeRingR;
      const themeY = cy + Math.sin(themeAngle) * themeRingR;
      const connectedSubthemes = subthemeNodes.filter(n => n.primaryThemeId === theme.id);
      const subRingR = 180;
      connectedSubthemes.forEach((sub, si) => {
        const subAngle = (2 * Math.PI * si) / Math.max(connectedSubthemes.length, 1) - Math.PI / 2;
        dispatch({ type: 'UPDATE_NODE', id: sub.id, changes: {
          x: themeX + Math.cos(subAngle) * subRingR,
          y: themeY + Math.sin(subAngle) * subRingR,
        }});
      });
    });

    // Unassigned subthemes
    const unassignedSubthemes = subthemeNodes.filter(n => !n.primaryThemeId);
    unassignedSubthemes.forEach((sub, i) => {
      const angle = (2 * Math.PI * i) / Math.max(unassignedSubthemes.length, 1) - Math.PI / 2;
      dispatch({ type: 'UPDATE_NODE', id: sub.id, changes: {
        x: cx + Math.cos(angle) * 160,
        y: cy + Math.sin(angle) * 160,
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
    // Report exports as a real text document via the print stylesheet
    // (design §4) — html2canvas would rasterize the prose.
    if (view === 'report') { window.print(); return; }
    const el = document.getElementById('canvas-export-target');
    if (el) await exportToPdf(el);
  }

  // ── Bulk actions ────────────────────────────────────────────────────────────
  function handleBulkDelete() {
    dispatch({ type: 'DELETE_NODES', ids: [...selectedNodeIds] });
    setSelectedNodeIds(new Set());
  }

  function handleBulkAssign(targetId) {
    const codeIds = [...selectedNodeIds].filter(nodeId => {
      const n = nodes.find(nd => nd.id === nodeId);
      return n && n.type === 'code';
    });
    dispatch({ type: 'BULK_ASSIGN_THEME', nodeIds: codeIds, targetId });
    setSelectedNodeIds(new Set());
  }

  // ── Context menu handler (from Canvas) ──────────────────────────────────────
  function handleContextMenu(type, id, x, y) {
    let items = [];

    // Selection context menu (multi-select)
    if (selectedNodeIds.size > 1 && selectedNodeIds.has(id)) {
      const hasCode = [...selectedNodeIds].some(nodeId => {
        const n = nodes.find(nd => nd.id === nodeId);
        return n && n.type === 'code';
      });
      items = [
        { label: `✕ Delete ${selectedNodeIds.size} nodes`, action: handleBulkDelete, danger: true },
      ];
      if (hasCode) {
        const assignTargets = nodes.filter(n => n.type === 'theme' || n.type === 'subtheme');
        assignTargets.forEach(n => {
          items.push({ label: `Assign to: ${n.label}`, action: () => handleBulkAssign(n.id) });
        });
      }
      setCtxMenu({ visible: true, x, y, items });
      return;
    }

    if (type === 'code-edit' || type === 'code') {
      items = [
        { label: '✏ Rename / Edit Code',  action: () => setCodeEditId(id) },
        { label: '✕ Delete Node',         action: () => dispatch({ type: 'DELETE_NODE', id }), danger: true },
      ];
    } else if (type === 'theme-edit' || type === 'theme') {
      items = [
        { label: '✏ Rename / Edit Theme', action: () => setThemeEditId(id) },
        { label: '＋ Add Subtheme', action: () => {
            const themeNode = nodes.find(n => n.id === id);
            const subId = makeId('subtheme');
            // x/y are screen coords (context menu position) — convert to world
            const world = screenToWorldRef.current ? screenToWorldRef.current(x, y) : { x, y };
            dispatch({ type: 'ADD_NODE', node: {
              id: subId, type: 'subtheme', label: 'New Subtheme',
              primaryThemeId: id, color: themeNode?.color ?? UNASSIGNED_COLOR,
              x: world.x + 160, y: world.y + 80,
              wallPosition: { x: world.x + 160, y: world.y + 80 },
            }});
            dispatch({ type: 'ADD_EDGE', edge: { id: makeId('edge'), source: subId, target: id }});
            setSubthemeEditId(subId);
          }
        },
        { label: '⊙ Focus View', action: () => handleSetFocusTheme(id) },
        // Export one theme's region as a standalone figure (Wall view only)
        ...(view === 'wall' && (regions || []).some(r => r.themeId === id) ? [{
          label: '⬇ Export Region as PNG',
          action: async () => {
            const region = regions.find(r => r.themeId === id);
            const themeNode = nodes.find(n => n.id === id);
            const el = document.getElementById('canvas-export-target');
            if (region && el && wallCropRef.current) {
              const slug = (themeNode?.label || 'theme').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'theme';
              await exportRegionToPng(el, wallCropRef.current(region.rect), slug);
            }
          },
        }] : []),
        // Recreate a deleted Wall region for this theme
        ...(!(regions || []).some(r => r.themeId === id) ? [{
          label: '▦ Show on Wall',
          action: () => {
            const themeNode = nodes.find(n => n.id === id);
            const cx = themeNode?.wallPosition?.x ?? themeNode?.x ?? window.innerWidth / 2;
            const cy = themeNode?.wallPosition?.y ?? themeNode?.y ?? window.innerHeight / 2;
            dispatch({ type: 'ADD_REGION', region: {
              id: `region-${id}`, themeId: id,
              rect: { x: cx - 220, y: cy - 160, w: 440, h: 320 },
            }});
          },
        }] : []),
        { label: collapsedNodeIds.has(id) ? '⊞ Expand Codes' : '⊟ Collapse Codes', action: () => toggleCollapse(id) },
        { label: '✕ Delete Theme', action: () => {
            const connectedCount = edges.filter(e => e.target === id).length;
            const msg = connectedCount > 0
              ? `Delete theme? ${connectedCount} connected node(s) will become unassigned.`
              : 'Delete this theme?';
            if (window.confirm(msg)) {
              dispatch({ type: 'DELETE_NODE', id });
              setCollapsedNodeIds(prev => { const next = new Set(prev); next.delete(id); return next; });
            }
          }, danger: true },
      ];
    } else if (type === 'subtheme') {
      items = [
        { label: '✏ Rename Subtheme', action: () => setSubthemeEditId(id) },
        { label: collapsedNodeIds.has(id) ? '⊞ Expand Codes' : '⊟ Collapse Codes', action: () => toggleCollapse(id) },
        { label: '✕ Delete Subtheme', action: () => {
            const subthemeNode = nodes.find(n => n.id === id);
            if (window.confirm(`Delete subtheme "${subthemeNode?.label ?? 'this subtheme'}"?`)) {
              dispatch({ type: 'DELETE_NODE', id });
              setCollapsedNodeIds(prev => { const next = new Set(prev); next.delete(id); return next; });
            }
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

  // ── Search match count (announced by Toolbar; highlight logic in Canvas) ────
  const matchCount = useMemo(
    () => getMatchedNodeIds(nodes, searchQuery, searchFilters).size,
    [nodes, searchQuery, searchFilters]
  );

  // ── Status bar counts ────────────────────────────────────────────────────────
  const codeCount      = nodes.filter(n => n.type === 'code').length;
  const themeCount     = nodes.filter(n => n.type === 'theme').length;
  const subthemeCount  = nodes.filter(n => n.type === 'subtheme').length;
  const unassignedCount = nodes.filter(n => n.type === 'code' && !n.primaryThemeId).length;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--text-primary)' }}>

      <Toolbar
        view={view}
        onViewChange={setView}
        connectMode={connectMode}
        physicsOpen={physicsOpen}
        onImport={() => setImportOpen(true)}
        onAddTheme={handleAddTheme}
        onAddCode={handleAddCode}
        onAddSubtheme={handleAddSubtheme}
        onToggleConnect={handleToggleConnect}
        onFitView={() => fitViewFn.current?.()}
        onZoomIn={() => zoomByFn.current?.(1.4)}
        onZoomOut={() => zoomByFn.current?.(1 / 1.4)}
        onExportPng={handleExportPng}
        onExportPdf={handleExportPdf}
        onTogglePhysics={() => setPhysicsOpen(o => !o)}
        onAlign={handleAlign}
        onClear={handleClear}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        searchOpen={searchOpen}
        searchQuery={searchQuery}
        searchFilters={searchFilters}
        onSearchToggle={() => { setSearchOpen(o => !o); if (searchOpen) setSearchQuery(''); }}
        onSearchChange={setSearchQuery}
        onSearchFilterChange={(key) => setSearchFilters(f => ({ ...f, [key]: !f[key] }))}
        matchCount={matchCount}
      />

      <div className="flex flex-1 overflow-hidden" ref={canvasRef}>
        {view === 'graph' ? (
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
            collapsedNodeIds={collapsedNodeIds}
            selectedNodeIds={selectedNodeIds}
            onShiftClickNode={handleShiftClickNode}
            onClearSelection={() => setSelectedNodeIds(new Set())}
            onScreenToWorldReady={(fn) => { screenToWorldRef.current = fn; }}
          />
        ) : view === 'wall' ? (
          <WallView
            onContextMenu={handleContextMenu}
            onCropRectReady={(fn) => { wallCropRef.current = fn; }}
          />
        ) : view === 'sankey' ? (
          <SankeyView
            onEditCode={setCodeEditId}
            onImport={() => setImportOpen(true)}
          />
        ) : (
          <ReportView />
        )}
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
        {/* #ef4444 (not #dc2626) — meets 4.5:1 on the near-black bar */}
        <span style={{ color: '#ef4444' }}>{unassignedCount} unassigned</span>
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