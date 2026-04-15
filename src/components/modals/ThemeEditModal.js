/**
 * ThemeEditModal.js
 * ──────────────────────────────────────────────────────────────────────────
 * Modal for editing a theme node. Allows:
 *   - Renaming the theme
 *   - Changing the theme color (color picker)
 *   - Deleting the theme (warns that connected codes become unassigned)
 *
 * PROPS:
 *   nodeId    {string|null}  — null = closed
 *   onClose   {fn}
 */

import React, { useState, useEffect } from 'react';
import { useGraph, useGraphDispatch } from '../../context/GraphContext';
import { UNASSIGNED_COLOR } from '../../context/GraphContext';

export default function ThemeEditModal({ nodeId, onClose }) {
  const { nodes, edges } = useGraph();
  const dispatch          = useGraphDispatch();

  const node = nodes.find(n => n.id === nodeId) ?? null;

  const [label, setLabel] = useState('');
  const [color, setColor] = useState('#4f46e5');

  useEffect(() => {
    if (node) { setLabel(node.label); setColor(node.color); }
  }, [nodeId]); // eslint-disable-line

  if (!node) return null;

  const connectedCodeCount = edges.filter(e => e.target === nodeId).length;

  function handleSave() {
    // Update theme node
    dispatch({ type: 'UPDATE_NODE', id: nodeId, changes: { label: label.trim() || node.label, color } });
    // Update color on all code nodes whose primaryThemeId is this theme
    nodes
      .filter(n => n.type === 'code' && n.primaryThemeId === nodeId)
      .forEach(n => dispatch({ type: 'UPDATE_NODE', id: n.id, changes: { color } }));
    onClose();
  }

  function handleDelete() {
    const msg = connectedCodeCount > 0
      ? `Delete theme "${node.label}"? ${connectedCodeCount} connected code node(s) will become unassigned.`
      : `Delete theme "${node.label}"?`;
    if (window.confirm(msg)) {
      // Revert connected code nodes to unassigned
      nodes
        .filter(n => n.type === 'code' && n.primaryThemeId === nodeId)
        .forEach(n => dispatch({ type: 'UPDATE_NODE', id: n.id, changes: { primaryThemeId: null, color: UNASSIGNED_COLOR } }));
      dispatch({ type: 'DELETE_NODE', id: nodeId });
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-800 border border-slate-600 rounded-2xl p-7 w-[520px] max-w-full shadow-2xl" onClick={e => e.stopPropagation()}>

        <h2 className="text-xl font-bold text-white mb-1">Edit Theme</h2>
        <p className="text-base text-slate-400 mb-6">
          {connectedCodeCount} code{connectedCodeCount !== 1 ? 's' : ''} connected to this theme.
        </p>

        {/* Theme label */}
        <label className="block text-base font-semibold text-slate-300 mb-2">Theme Name</label>
        <input
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-base text-white placeholder-slate-500 mb-5 focus:outline-none focus:border-indigo-500"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Enter theme name…"
        />

        {/* Color picker */}
        <label className="block text-base font-semibold text-slate-300 mb-3">Theme Color</label>
        <div className="flex items-center gap-4 mb-6">
          <input
            type="color"
            value={color}
            onChange={e => setColor(e.target.value)}
            className="w-14 h-14 rounded-lg border-0 cursor-pointer bg-transparent"
          />
          <div className="w-16 h-16 rounded-full border-2 border-white/20 shadow-lg" style={{ backgroundColor: color }} />
          <span className="text-base font-mono text-slate-400">{color}</span>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center">
          <button onClick={handleDelete} className="text-base font-semibold text-red-400 hover:text-red-300 px-4 py-2 rounded-lg hover:bg-red-900/30 transition-colors">
            Delete Theme
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="text-base font-semibold text-slate-400 px-5 py-2 rounded-lg border border-slate-600 hover:bg-slate-700 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} className="text-base font-bold text-white px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors">
              Save
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
