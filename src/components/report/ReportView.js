/**
 * ReportView.js
 * ──────────────────────────────────────────────────────────────────────────
 * Living Report — four-view entry. Renders auto-seeded chapters in read-only
 * mode (edit mode added in Task 4, present mode in Task 6).
 *
 * Derives effectiveSections from the graph: stored sections in order, plus
 * auto-seeded empty sections for themes not yet in the report (at derivation
 * time, never during render dispatch).
 *
 * Empty state when there are no themes and no stored sections.
 */

import React from 'react';
import { useGraph } from '../../context/GraphContext';
import { effectiveSections } from '../../utils/reportUtils';
import ReportChapter from './ReportChapter';

export default function ReportView() {
  const { nodes, report } = useGraph();
  const sections = effectiveSections(report, nodes);
  const hasThemes = nodes.some(n => n.type === 'theme');
  const hasStoredSections = report?.sections?.length > 0;

  // Empty state: no themes and no stored sections
  if (!hasThemes && !hasStoredSections) {
    return (
      <div className="flex flex-1 items-center justify-center overflow-hidden p-6">
        <div
          className="p-8 bg-white border-2 border-[#0f0d0a] w-full max-w-md"
          style={{ boxShadow: '8px 8px 0 #0f0d0a' }}
        >
          <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            No chapters yet
          </h2>
          <p className="text-base leading-relaxed" style={{ color: '#6b6560', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            Each theme becomes a chapter of your findings. Add themes in the Graph or Wall view, then write the story here.
          </p>
        </div>
      </div>
    );
  }

  // Render chapters in a scrollable article
  return (
    <div
      id="canvas-export-target"
      data-testid="report-edit"
      className="flex-1 overflow-y-auto"
      style={{ backgroundColor: 'var(--bg-canvas)' }}
    >
      <article
        id="report-print-root"
        style={{
          maxWidth: '68ch',
          margin: '0 auto',
          fontSize: 17,
          lineHeight: 1.6,
          padding: '48px 24px',
        }}
      >
        {sections.map(section => (
          <ReportChapter key={section.themeId} section={section} mode="edit" />
        ))}
      </article>
    </div>
  );
}
