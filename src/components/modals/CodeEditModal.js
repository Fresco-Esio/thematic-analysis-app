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
      <div className="bg-slate-800 border border-slate-600 rounded-2xl p-7 w-[600px] max-w-full shadow-2xl" onClick={e => e.stopPropagation()}>

        <h2 className="text-xl font-bold text-white mb-1">Edit Code Node</h2>
        <p className="text-base text-slate-400 mb-6">Update the code label or quote text.</p>

        {/* Code label */}
        <label className="block text-base font-semibold text-slate-300 mb-2">Code Label</label>
        <input
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-base text-white placeholder-slate-500 mb-5 focus:outline-none focus:border-indigo-500"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Enter data code label…"
        />

        {/* Quote text */}
        <label className="block text-base font-semibold text-slate-300 mb-2">Raw Quote</label>
        <textarea
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-base text-white placeholder-slate-500 mb-5 focus:outline-none focus:border-indigo-500 resize-none"
          rows={4}
          value={quote}
          onChange={e => setQuote(e.target.value)}
          placeholder="Paste the interview quote here…"
        />

        {/* Connected themes */}
        {connectedThemes.length > 0 && (
          <div className="mb-6">
            <p className="text-base font-semibold text-slate-300 mb-2">Connected Themes</p>
            <div className="flex flex-wrap gap-2">
              {connectedThemes.map(t => (
                <span key={t.id} className="text-base font-semibold px-3 py-1 rounded-full text-white" style={{ backgroundColor: t.color }}>
                  {t.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center">
          <button onClick={handleDelete} className="text-base font-semibold text-red-400 hover:text-red-300 px-4 py-2 rounded-lg hover:bg-red-900/30 transition-colors">
            Delete Node
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
