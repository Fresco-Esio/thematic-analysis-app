/**
 * SubthemeEditModal.js
 * ─────────────────────────────────────────────────────────────────────────
 * Modal for editing a subtheme node. Allows:
 *   - Renaming the subtheme label
 *   - Deleting the subtheme
 *
 * PROPS:
 *   nodeId    {string|null}  — null = closed
 *   onClose   {fn}
 */

import React, { useState, useEffect } from 'react';
import { useGraph, useGraphDispatch } from '../../context/GraphContext';

export default function SubthemeEditModal({ nodeId, onClose }) {
  const { nodes, edges } = useGraph();
  const dispatch  = useGraphDispatch();
  const node = nodes.find(n => n.id === nodeId) ?? null;
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (node) setLabel(node.label);
  }, [nodeId]); // eslint-disable-line

  useEffect(() => {
    if (!node) return;
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [node, onClose]);

  if (!node) return null;

  function handleSave() {
    dispatch({ type: 'UPDATE_NODE', id: nodeId, changes: { label: label.trim() || node.label } });
    onClose();
  }

  function handleDelete() {
    const connectedCount = edges.filter(e => e.source === nodeId || e.target === nodeId).length;
    const msg = connectedCount > 0
      ? `Delete subtheme "${node.label}"? ${connectedCount} connected node(s) will become unassigned.`
      : `Delete subtheme "${node.label}"?`;
    if (window.confirm(msg)) {
      dispatch({ type: 'DELETE_NODE', id: nodeId });
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="subtheme-edit-modal-title"
        className="bg-white rounded-none border-2 border-[#0f0d0a] p-7 w-[480px] max-w-full shadow-[8px_8px_0_#0f0d0a]"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="subtheme-edit-modal-title" className="text-xl font-bold text-[#0f0d0a] mb-6">Edit Subtheme</h2>

        <label className="block text-base font-bold text-[#0f0d0a] mb-2">Subtheme Name</label>
        <input
          className="w-full bg-white border-2 border-[#0f0d0a] px-4 py-3 text-base text-[#0f0d0a] placeholder-[#6b6560] mb-6 focus:outline-none focus:border-[#dc2626] font-bold"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Enter subtheme name…"
          autoFocus
        />

        <div className="flex justify-between items-center">
          <button onClick={handleDelete} className="text-base font-bold text-[#dc2626] border-2 border-[#dc2626] px-4 py-2 hover:bg-[#dc2626] hover:text-white transition-colors">
            Delete Subtheme
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
