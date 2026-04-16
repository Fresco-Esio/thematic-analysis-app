/**
 * CodeEditModal.js
 * ──────────────────────────────────────────────────────────────────────────
 * Modal for editing a code node. Allows:
 *   - Editing the code label
 *   - Editing the raw quote text
 *   - Viewing connected themes
 *   - Deleting the node
 *
 * PROPS:
 *   nodeId    {string|null}  — null = closed
 *   onClose   {fn}
 */

import React, { useState, useEffect } from 'react';
import { useGraph, useGraphDispatch } from '../../context/GraphContext';

export default function CodeEditModal({ nodeId, onClose }) {
  const { nodes, edges } = useGraph();
  const dispatch          = useGraphDispatch();

  const node = nodes.find(n => n.id === nodeId) ?? null;

  const [label, setLabel] = useState('');
  const [quote, setQuote] = useState('');

  // Sync form state when node changes
  useEffect(() => {
    if (node) { setLabel(node.label); setQuote(node.quote ?? ''); }
  }, [nodeId]); // eslint-disable-line

  // Escape key closes modal
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!node) return null;

  // Find connected themes
  const connectedThemeIds = edges.filter(e => e.source === nodeId).map(e => e.target);
  const connectedThemes   = nodes.filter(n => connectedThemeIds.includes(n.id));

  function handleSave() {
    dispatch({ type: 'UPDATE_NODE', id: nodeId, changes: { label: label.trim() || node.label, quote } });
    onClose();
  }

  function handleDelete() {
    if (window.confirm(`Delete code node "${node.label}"? This cannot be undone.`)) {
      dispatch({ type: 'DELETE_NODE', id: nodeId });
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="code-edit-modal-title" className="bg-white border-2 border-[#0f0d0a] rounded-none p-7 w-[600px] max-w-full shadow-[8px_8px_0_#0f0d0a]" onClick={e => e.stopPropagation()}>

        <h2 id="code-edit-modal-title" className="text-xl font-bold text-[#0f0d0a] mb-1">Edit Code Node</h2>
        <p className="text-base text-[#6b6560] mb-6">Update the code label or quote text.</p>

        {/* Code label */}
        <label className="block text-base font-bold text-[#0f0d0a] mb-2">Code Label</label>
        <input
          className="w-full bg-white border-2 border-[#0f0d0a] px-4 py-3 text-base text-[#0f0d0a] placeholder-[#6b6560] mb-5 focus:outline-none focus:border-[#dc2626] font-bold"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Enter data code label…"
        />

        {/* Quote text */}
        <label className="block text-base font-bold text-[#0f0d0a] mb-2">Raw Quote</label>
        <textarea
          className="w-full bg-white border-2 border-[#0f0d0a] px-4 py-3 text-base text-[#0f0d0a] placeholder-[#6b6560] mb-5 focus:outline-none focus:border-[#dc2626] resize-none"
          rows={4}
          value={quote}
          onChange={e => setQuote(e.target.value)}
          placeholder="Paste the interview quote here…"
        />

        {/* Connected themes */}
        {connectedThemes.length > 0 && (
          <div className="mb-6">
            <p className="text-base font-bold text-[#0f0d0a] mb-2">Connected Themes</p>
            <div className="flex flex-wrap gap-2">
              {connectedThemes.map(t => (
                <span key={t.id} className="text-base font-bold px-3 py-1 text-white" style={{ backgroundColor: t.color }}>
                  {t.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center">
          <button onClick={handleDelete} className="text-base font-bold text-[#dc2626] border-2 border-[#dc2626] px-4 py-2 hover:bg-[#dc2626] hover:text-white transition-colors">
            Delete Node
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
