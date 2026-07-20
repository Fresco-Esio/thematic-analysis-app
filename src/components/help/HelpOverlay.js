/**
 * HelpOverlay.js
 * ──────────────────────────────────────────────────────────────────────────
 * In-app help modal with workflow overview, view guides, and sample project loader.
 *
 * PROPS:
 *   open      {boolean}  — overlay visibility
 *   view      {string}   — current view ('wall', 'graph', 'outline', 'report')
 *   onClose   {fn}       — close handler
 */

import React, { useEffect, useRef } from 'react';
import { useGraphDispatch } from '../../context/GraphContext';
import { buildSampleProject } from '../../utils/sampleProject';

export default function HelpOverlay({ open, view, onClose }) {
  const dispatch = useGraphDispatch();
  const dialogRef = useRef(null);

  // Escape key closes modal
  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Move keyboard focus into the dialog when it opens
  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  function handleLoadSample() {
    if (window.confirm('Load the sample project? This replaces the current workspace and cannot be undone.')) {
      dispatch({ type: 'SET_GRAPH', ...buildSampleProject() });
      onClose();
    }
  }

  if (!open) return null;

  // View guide content: icon + name + bullets
  const viewGuides = {
    wall: {
      icon: '▦',
      name: 'Wall',
      bullets: [
        'Drag cards onto the wall: dropping a card inside a theme\'s region assigns it',
        'Dropping on empty wall unassigns; overlapping two regions shows a contested "?" badge',
        'Unsorted codes wait in the left tray; arrow keys move a focused card (Shift = fine)',
      ],
    },
    graph: {
      icon: '☄',
      name: 'Graph',
      bullets: [
        'Physics-driven overview of your themes and codes',
        '↔ Connect draws code→theme links; right-click nodes for rename/edit/focus/delete',
        '⊹ Align lays out themes radially; ⚙ Physics tunes the forces',
      ],
    },
    outline: {
      icon: '≣',
      name: 'Outline',
      bullets: [
        'Themes as color bands (biggest first) with subthemes and code chips inside',
        'Click a theme band to isolate it; click a code chip to edit it; hover for its quote',
        '⚠ marks themes grounded in a single source; the matrix below shows codes per theme × source',
      ],
    },
    report: {
      icon: '¶',
      name: 'Report',
      bullets: [
        'Every theme becomes a chapter; click a paragraph to edit (**bold** and *italic* markers supported, saved when you click away)',
        'Add pull quotes from each chapter\'s code tray',
        '▶ Present for a full-screen reading mode with a wall mini-map; ↓ PDF prints a text-selectable document',
      ],
    },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        data-testid="help-overlay"
        className="bg-white border-2 border-[#0f0d0a] rounded-none p-7 w-[760px] max-w-full shadow-[8px_8px_0_#0f0d0a] max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Title */}
        <h2 id="help-title" className="text-2xl font-bold text-[#0f0d0a] mb-1">
          ThematicMap: how it works
        </h2>
        <p className="text-base text-[#6b6560] mb-6">
          A visual workspace for Braun & Clarke reflexive thematic analysis; for academic/research use.
        </p>

        {/* Workflow strip */}
        <div className="border-2 border-[#0f0d0a] px-4 py-3 mb-6 font-bold text-sm">
          <span className="text-[#0f0d0a]">⬆ Import → ▦ Wall (sort codes into themes) → ≣ Outline (check your evidence) → ¶ Report (write it up) → ↓ Export</span>
        </div>

        {/* View guides */}
        <div className="space-y-4 mb-6">
          {Object.entries(viewGuides).map(([key, { icon, name, bullets }]) => {
            const isActive = view === key;
            return (
              <div
                key={key}
                className={isActive ? 'border-2 border-[#dc2626] p-3' : 'p-3 border-2 border-transparent'}
                style={isActive ? { backgroundColor: 'rgba(220, 38, 38, 0.05)' } : {}}
              >
                <h3 className="text-base font-bold text-[#0f0d0a] mb-2">
                  {icon} {name}
                </h3>
                <ul className="text-sm text-[#6b6560] space-y-1">
                  {bullets.map((bullet, i) => (
                    <li key={i} className="ml-4">• {bullet}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Shortcuts */}
        <div className="text-sm text-[#6b6560] mb-4 font-bold">
          <span className="text-[#0f0d0a]">Shortcuts: </span>
          Ctrl+Z / Ctrl+Y undo/redo · Escape exits focus, isolation, present, or this help · arrows move a focused wall card
        </div>

        {/* Data note */}
        <div className="text-xs text-[#6b6560] mb-6">
          Work is saved automatically in this browser only. Export PNG/PDF to share results.
        </div>

        {/* Footer buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={handleLoadSample}
            className="text-base font-bold text-white px-5 py-2 bg-[#dc2626] border-2 border-[#dc2626] shadow-[3px_3px_0_#0f0d0a] hover:bg-[#b91c1c] transition-colors"
            aria-label="Load sample project"
          >
            Load sample project
          </button>
          <button
            onClick={onClose}
            className="text-base font-bold text-[#0f0d0a] px-5 py-2 border-2 border-[#0f0d0a] hover:bg-[#0f0d0a] hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
