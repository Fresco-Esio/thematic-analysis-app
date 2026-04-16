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

  // Escape key closes modal
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

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
      <div role="dialog" aria-modal="true" aria-labelledby="theme-edit-modal-title" className="bg-white border-2 border-[#0f0d0a] rounded-none p-7 w-[520px] max-w-full shadow-[8px_8px_0_#0f0d0a]" onClick={e => e.stopPropagation()}>

        <h2 id="theme-edit-modal-title" className="text-xl font-bold text-[#0f0d0a] mb-1">Edit Theme</h2>
        <p className="text-base text-[#6b6560] mb-6">
          {connectedCodeCount} code{connectedCodeCount !== 1 ? 's' : ''} connected to this theme.
        </p>

        {/* Theme label */}
        <label className="block text-base font-bold text-[#0f0d0a] mb-2">Theme Name</label>
        <input
          className="w-full bg-white border-2 border-[#0f0d0a] px-4 py-3 text-base text-[#0f0d0a] placeholder-[#6b6560] mb-5 focus:outline-none focus:border-[#dc2626] font-bold"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Enter theme name…"
        />

        {/* Color picker */}
        <label className="block text-base font-bold text-[#0f0d0a] mb-3">Theme Color</label>
        <div className="flex items-center gap-4 mb-6">
          <input
            type="color"
            value={color}
            onChange={e => setColor(e.target.value)}
            className="w-14 h-14 border-2 border-[#0f0d0a] cursor-pointer bg-transparent"
          />
          <div className="w-16 h-16 border-2 border-[#0f0d0a]" style={{ backgroundColor: color }} />
          <span className="text-base font-mono font-bold text-[#6b6560]">{color}</span>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center">
          <button onClick={handleDelete} className="text-base font-bold text-[#dc2626] border-2 border-[#dc2626] px-4 py-2 hover:bg-[#dc2626] hover:text-white transition-colors">
            Delete Theme
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="text-base font-bold text-[#0f0d0a] px-5 py-2 border-2 border-[#0f0d0a] hover:bg-[#0f0d0a] hover:text-white transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} className="text-base font-bold text-white px-5 py-2 bg-[#dc2626] border-2 border-[#dc2626] shadow-[3px_3px_0_#0f0d0a] hover:bg-[#b91c1c] transition-colors">
              Save
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
