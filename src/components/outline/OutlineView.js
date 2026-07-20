/**
 * OutlineView.js
 * ──────────────────────────────────────────────────────────────────────────
 * Outline — the written-up shape of the analysis, as a scrollable document:
 * theme bands (height = prevalence) → subtheme sub-bands → code chips, then
 * a theme × source grounding matrix (rendered once ≥2 sources exist).
 *
 * Replaces the Sankey: with one source and unique value-1 codes, ribbons
 * carried no signal and 60+ labels collided in a fixed frame. A document
 * with dynamic height cannot collide.
 *
 * The document root carries id="canvas-export-target" (shared export id —
 * Canvas / WallView / OutlineView / ReportView are mutually exclusive mounts).
 *
 * PROPS:
 *   onEditCode {fn(nodeId)} — open CodeEditModal (the only edit affordance)
 *   onImport   {fn}         — open ImportModal from the empty state
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useGraph } from '../../context/GraphContext';
import { buildOutline } from '../../utils/outlineTransform';
import QuoteTooltip from '../QuoteTooltip';

function CodeChip({ code, onClick, onMove, onLeave }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Edit code ${code.label}`}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="px-2.5 py-1.5 text-sm font-semibold border-2 border-[#0f0d0a] bg-white cursor-pointer hover:shadow-[3px_3px_0_#0f0d0a]"
      style={{ borderLeft: `6px solid ${code.color || '#6b7280'}` }}
    >
      {code.label}
    </div>
  );
}

export default function OutlineView({ onEditCode, onImport }) {
  const { nodes, edges } = useGraph();
  const wrapRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);           // { x, y, node } | null
  const [isolatedThemeId, setIsolatedThemeId] = useState(null);

  useEffect(() => {
    if (!isolatedThemeId) return;
    function onKey(e) { if (e.key === 'Escape') setIsolatedThemeId(null); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isolatedThemeId]);

  const data = useMemo(() => buildOutline(nodes, edges), [nodes, edges]);

  function chipHandlers(code) {
    return {
      onClick: () => onEditCode?.(code.id),
      onMove: (e) => {
        const rect = wrapRef.current.getBoundingClientRect();
        setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, node: code });
      },
      onLeave: () => setTooltip(null),
    };
  }

  if (data.isEmpty) {
    return (
      <div className="flex-1 relative flex items-center justify-center overflow-hidden" style={{ backgroundColor: 'var(--bg-canvas)' }}>
        <div className="text-center max-w-md p-8 border-2 border-[#0f0d0a] bg-white shadow-[8px_8px_0_#0f0d0a]">
          <p className="text-xl font-bold mb-3">Nothing to outline yet</p>
          <p className="text-base mb-5" style={{ color: '#6b6560' }}>
            The Outline shows your themes with their subthemes and codes, plus
            how each theme is grounded across sources. Import a CSV/Excel of
            coded excerpts, or add codes and connect them to themes.
          </p>
          <button
            onClick={onImport}
            className="px-4 py-2 font-bold text-base cursor-pointer border-2 bg-[#dc2626] text-white border-[#dc2626] hover:bg-[#b91c1c] shadow-[3px_3px_0_#0f0d0a]"
          >
            ⬆ Import Data
          </button>
        </div>
      </div>
    );
  }

  const maxCell = Math.max(1, ...data.themes.flatMap(t => [...t.sourceCounts.values()]));

  return (
    <div ref={wrapRef} className="flex-1 relative overflow-y-auto" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      <div
        id="canvas-export-target"
        className="mx-auto my-8 bg-white border-2 border-[#0f0d0a] shadow-[8px_8px_0_#0f0d0a] p-8"
        style={{ maxWidth: 1080 }}
      >
        <p className="text-sm font-extrabold tracking-[0.14em] mb-6" style={{ color: '#6b6560' }}>
          THEMATIC OUTLINE
        </p>

        {data.themes.map(({ theme, subthemes, looseCodes, codeCount, sourceCounts }) => {
          const collapsed = isolatedThemeId && isolatedThemeId !== theme.id;
          const warned = data.warnings.has(theme.id);
          return (
            <section key={theme.id} data-testid="outline-theme" className="mb-5" style={{ opacity: collapsed ? 0.45 : 1 }}>
              <div
                role="button"
                tabIndex={0}
                aria-label={`Isolate theme ${theme.label}`}
                onClick={() => setIsolatedThemeId(prev => (prev === theme.id ? null : theme.id))}
                onKeyDown={(e) => { if (e.key === 'Enter') setIsolatedThemeId(prev => (prev === theme.id ? null : theme.id)); }}
                className="flex items-center justify-between px-4 py-2.5 border-2 border-[#0f0d0a] cursor-pointer"
                style={{ backgroundColor: theme.color || '#6b7280', color: '#ffffff' }}
              >
                <span className="font-extrabold text-lg">
                  {warned && (
                    <span title="Grounded in a single source: consider whether this theme rests on one voice">⚠ </span>
                  )}
                  {theme.label}
                </span>
                <span className="text-sm font-bold opacity-90">
                  {codeCount} {codeCount === 1 ? 'code' : 'codes'} · {sourceCounts.size} {sourceCounts.size === 1 ? 'source' : 'sources'}
                </span>
              </div>

              {!collapsed && (
                <div className="border-2 border-t-0 border-[#0f0d0a] p-4 flex flex-col gap-4">
                  {subthemes.map(({ subtheme, codes }) => (
                    <div key={subtheme.id} className="pl-3" style={{ borderLeft: `4px solid ${subtheme.color || theme.color}` }}>
                      <p className="text-sm font-extrabold mb-2" style={{ color: '#0f0d0a' }}>{subtheme.label}</p>
                      <div className="flex flex-wrap gap-2">
                        {codes.map(c => <CodeChip key={c.id} code={c} {...chipHandlers(c)} />)}
                      </div>
                    </div>
                  ))}
                  {looseCodes.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {looseCodes.map(c => <CodeChip key={c.id} code={c} {...chipHandlers(c)} />)}
                    </div>
                  )}
                  {codeCount === 0 && (
                    <p className="text-sm italic" style={{ color: '#6b6560' }}>No codes assigned yet.</p>
                  )}
                </div>
              )}
            </section>
          );
        })}

        {data.unassigned.length > 0 && (
          <section data-testid="outline-unassigned" className="mb-5">
            <div className="px-4 py-2.5 border-2 border-[#0f0d0a] font-extrabold text-lg text-white" style={{ backgroundColor: '#6b7280' }}>
              Unassigned <span className="text-sm font-bold opacity-90">· {data.unassigned.length}</span>
            </div>
            <div className="border-2 border-t-0 border-[#0f0d0a] p-4 flex flex-wrap gap-2">
              {data.unassigned.map(c => <CodeChip key={c.id} code={c} {...chipHandlers(c)} />)}
            </div>
          </section>
        )}

        {/* Grounding matrix — only meaningful across ≥2 sources */}
        {data.sources.length >= 2 ? (
          <section data-testid="grounding-matrix" className="mt-8">
            <p className="text-sm font-extrabold tracking-[0.14em] mb-3" style={{ color: '#6b6560' }}>
              GROUNDING — CODES PER THEME × SOURCE
            </p>
            <div className="overflow-x-auto">
              <table className="border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="text-left pr-4 pb-2 font-extrabold" />
                    {data.sources.map(s => (
                      <th key={s} className="px-2 pb-2 font-bold text-left max-w-[120px] truncate" title={s}>{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.themes.map(({ theme, sourceCounts }) => (
                    <tr key={theme.id}>
                      <td className="pr-4 py-1 font-extrabold whitespace-nowrap">
                        <span className="inline-block w-3 h-3 mr-2 border border-[#0f0d0a] align-middle" style={{ backgroundColor: theme.color || '#6b7280' }} />
                        {theme.label}
                      </td>
                      {data.sources.map(s => {
                        const n = sourceCounts.get(s) || 0;
                        return (
                          <td
                            key={s}
                            className="px-2 py-1 text-center border border-[#0f0d0a] font-bold min-w-[44px]"
                            style={n > 0 ? {
                              backgroundColor: theme.color || '#6b7280',
                              color: '#ffffff',
                              opacity: 0.35 + 0.65 * (n / maxCell),
                            } : { color: '#d6d0c8' }}
                          >
                            {n > 0 ? n : ''}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <p data-testid="grounding-note" className="mt-8 text-sm italic" style={{ color: '#6b6560' }}>
            Grounding matrix appears when codes come from two or more sources.
          </p>
        )}
      </div>

      {isolatedThemeId && (
        <button
          onClick={() => setIsolatedThemeId(null)}
          className="fixed bottom-16 left-1/2 -translate-x-1/2 px-4 py-2 font-bold text-base border-2 border-[#0f0d0a] bg-[#0f0d0a] text-white cursor-pointer"
        >
          ✕ Show All Themes
        </button>
      )}

      <QuoteTooltip
        visible={!!tooltip}
        x={tooltip?.x ?? 0}
        y={tooltip?.y ?? 0}
        code={tooltip?.node?.label ?? ''}
        quote={tooltip?.node?.quote ?? ''}
        source={tooltip?.node?.source ?? ''}
        color={tooltip?.node?.color ?? '#0f0d0a'}
      />
    </div>
  );
}
