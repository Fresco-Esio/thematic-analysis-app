/**
 * ReportView.js
 * ──────────────────────────────────────────────────────────────────────────
 * Living Report — four-view entry. Renders auto-seeded chapters in edit mode
 * or a full-screen reading overlay in present mode.
 *
 * Derives effectiveSections from the graph: stored sections in order, plus
 * auto-seeded empty sections for themes not yet in the report (at derivation
 * time, never during render dispatch).
 *
 * Empty state when there are no themes and no stored sections.
 * Handles chapter reordering via REPORT_SET_ORDER.
 * Present mode: full-screen scroll with fixed mini-map and active chapter tracking.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useGraph, useGraphDispatch } from '../../context/GraphContext';
import { effectiveSections } from '../../utils/reportUtils';
import ReportChapter from './ReportChapter';
import ReportMiniMap from './ReportMiniMap';
import './reportPrint.css';

export default function ReportView() {
  const { nodes, report, regions } = useGraph();
  const dispatch = useGraphDispatch();
  const sections = effectiveSections(report, nodes);
  const hasThemes = nodes.some(n => n.type === 'theme');
  const hasStoredSections = report?.sections?.length > 0;

  // Present mode state
  const [mode, setMode] = useState('edit');
  const [activeThemeId, setActiveThemeId] = useState(null);
  const overlayScrollRef = useRef(null);
  const chapterRefsRef = useRef({});

  /**
   * Reorder chapters: swap positions and dispatch REPORT_SET_ORDER
   */
  function handleMoveChapter(currentIndex, direction) {
    const themeIds = sections.map(s => s.themeId);
    const newIndex = currentIndex + (direction === 'up' ? -1 : 1);

    if (newIndex < 0 || newIndex >= themeIds.length) return;

    // Swap
    [themeIds[currentIndex], themeIds[newIndex]] = [themeIds[newIndex], themeIds[currentIndex]];

    dispatch({
      type: 'REPORT_SET_ORDER',
      themeIds,
    });
  }

  /**
   * Enter present mode; initialize active theme to first section
   */
  function handleEnterPresent() {
    setMode('present');
    if (sections.length > 0) {
      setActiveThemeId(sections[0].themeId);
    }
  }

  /**
   * Exit present mode back to edit
   */
  const handleExitPresent = useCallback(() => {
    setMode('edit');
    setActiveThemeId(null);
  }, []);

  /**
   * Track active chapter while scrolling in present mode
   */
  function handlePresentScroll(e) {
    const overlay = e.currentTarget;
    const scrollTop = overlay.scrollTop;
    const viewportHeight = overlay.clientHeight;
    const threshold = scrollTop + viewportHeight / 3;

    // Find the LAST chapter whose offsetTop <= threshold
    let lastActive = null;
    sections.forEach(section => {
      const ref = chapterRefsRef.current[section.themeId];
      if (ref && ref.offsetTop <= threshold) {
        lastActive = section.themeId;
      }
    });

    if (lastActive !== null) {
      setActiveThemeId(lastActive);
    }
  }

  /**
   * Escape listener for present mode
   */
  useEffect(() => {
    function handleKeyDown(e) {
      if (mode !== 'present') return;
      if (e.key === 'Escape') {
        e.preventDefault();
        handleExitPresent();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, handleExitPresent]);

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

  // Present mode: full-screen overlay
  if (mode === 'present') {
    return (
      <>
        {/* Present overlay */}
        <div
          ref={overlayScrollRef}
          className="fixed inset-0 z-40 overflow-y-auto"
          style={{ backgroundColor: 'var(--bg-canvas)' }}
          onScroll={handlePresentScroll}
        >
          {/* Exit pill */}
          <button
            onClick={handleExitPresent}
            style={{
              position: 'fixed',
              top: '16px',
              right: '16px',
              zIndex: 50,
              padding: '8px 16px',
              backgroundColor: '#0f0d0a',
              color: '#f0ebe3',
              border: '2px solid #0f0d0a',
              borderRadius: '9999px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              fontFamily: 'Bricolage Grotesque, sans-serif',
            }}
          >
            ✕ Exit
          </button>

          {/* Article container */}
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
            {sections.map((section) => (
              <div
                key={section.themeId}
                ref={(el) => {
                  if (el) chapterRefsRef.current[section.themeId] = el;
                  else delete chapterRefsRef.current[section.themeId];
                }}
              >
                <ReportChapter
                  section={section}
                  mode="present"
                />
              </div>
            ))}
          </article>
        </div>

        {/* Mini-map */}
        <ReportMiniMap regions={regions} nodes={nodes} activeThemeId={activeThemeId} />
      </>
    );
  }

  // Edit mode: scrollable article with controls
  return (
    <div
      id="canvas-export-target"
      data-testid="report-edit"
      className="flex-1 overflow-y-auto"
      style={{ backgroundColor: 'var(--bg-canvas)' }}
    >
      {/* Edit mode header with Present button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '16px 24px',
          backgroundColor: 'var(--bg-canvas)',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <button
          onClick={handleEnterPresent}
          aria-label="Present the report full-screen"
          style={{
            padding: '8px 16px',
            backgroundColor: '#0f0d0a',
            color: '#f0ebe3',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            fontFamily: 'Bricolage Grotesque, sans-serif',
          }}
        >
          ▶ Present
        </button>
      </div>

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
        {sections.map((section, index) => (
          <ReportChapter
            key={section.themeId}
            section={section}
            mode="edit"
            onMoveUp={() => handleMoveChapter(index, 'up')}
            onMoveDown={() => handleMoveChapter(index, 'down')}
            isFirst={index === 0}
            isLast={index === sections.length - 1}
          />
        ))}
      </article>
    </div>
  );
}
