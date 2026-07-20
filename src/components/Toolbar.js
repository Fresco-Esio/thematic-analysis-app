/**
 * Toolbar.js
 * ──────────────────────────────────────────────────────────────────────────
 * Top toolbar with all primary actions.
 *
 * PROPS:
 *   view            {'wall'|'graph'|'outline'|'report'}  — active view; graph-only actions disable off-view
 *   onViewChange    {fn(view)}
 *   connectMode     {boolean}
 *   physicsOpen     {boolean}
 *   onImport        {fn}
 *   onAddTheme      {fn}
 *   onAddCode       {fn}
 *   onAddSubtheme   {fn}
 *   onToggleConnect {fn}
 *   onExportPng     {fn}
 *   onExportPdf     {fn}
 *   onTogglePhysics {fn}
 *   onClear         {fn}
 *   canUndo         {boolean}
 *   canRedo         {boolean}
 *   onUndo          {fn}
 *   onRedo          {fn}
 *   onHelp          {fn}
 *   helpOpen        {boolean}
 *   showHelpHint    {boolean}
 */

import React, { useRef, useEffect } from 'react';

function TbBtn({ children, onClick, variant = 'secondary', active = false, disabled = false, graphOnly = false, view = 'graph', ...rest }) {
  // graphOnly actions disable (not disappear) when another view is active
  const isDisabled = disabled || (graphOnly && view !== 'graph');
  const base = 'px-4 py-2 font-bold text-base cursor-pointer transition-all border-2';
  const styles = {
    primary: 'bg-[#dc2626] text-white border-[#dc2626] hover:bg-[#b91c1c] shadow-[3px_3px_0_#0f0d0a]',
    secondary: active
      ? 'bg-white text-[#dc2626] border-[#dc2626]'
      : 'bg-transparent text-white border-white hover:bg-white hover:text-[#0f0d0a]',
    // #ef4444 (not #dc2626) for text on the near-black bar — meets 4.5:1
    danger: 'bg-transparent text-[#ef4444] border-[#ef4444] hover:bg-[#dc2626] hover:border-[#dc2626] hover:text-white',
  };
  const disabledClass = isDisabled ? 'opacity-30 cursor-not-allowed pointer-events-none' : '';
  return (
    <button className={`${base} ${styles[variant]} ${disabledClass}`} onClick={onClick} disabled={isDisabled} {...rest}>
      {children}
    </button>
  );
}

export default function Toolbar({
  view = 'graph',
  onViewChange,
  connectMode,
  physicsOpen,
  onImport,
  onAddTheme,
  onAddCode,
  onAddSubtheme,
  onToggleConnect,
  onFitView,
  onZoomIn,
  onZoomOut,
  onExportPng,
  onExportPdf,
  onTogglePhysics,
  onAlign,
  onClear,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  searchOpen,
  searchQuery,
  searchFilters,
  onSearchToggle,
  onSearchChange,
  onSearchFilterChange,
  matchCount = 0,
  onHelp,
  helpOpen = false,
  showHelpHint = false,
}) {
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  function handleSearchKeyDown(e) {
    if (e.key === 'Escape') onSearchToggle();
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-[#0f0d0a] border-b-2 border-[#dc2626] z-10 flex-shrink-0 flex-wrap">
      {/* App title */}
      <span className="text-2xl font-bold text-white mr-3">
        Thematic<span style={{ color: '#dc2626' }}>Map</span>
      </span>

      {/* View switcher — only views that exist are rendered */}
      <div role="group" aria-label="View" className="flex mr-2 border-2 border-white">
        {[['wall', '▦ Wall'], ['graph', '☄ Graph'], ['outline', '≣ Outline'], ['report', '¶ Report']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => onViewChange(key)}
            aria-pressed={view === key}
            className={`px-3 py-2 font-bold text-base cursor-pointer ${
              view === key ? 'bg-white text-[#0f0d0a]' : 'bg-transparent text-white hover:bg-white/20'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <TbBtn variant="primary" onClick={onImport}>⬆ Import</TbBtn>
      <TbBtn variant="primary" onClick={onAddTheme}>＋ Add Theme</TbBtn>
      <TbBtn variant="primary" onClick={onAddCode}>＋ Add Code</TbBtn>
      <TbBtn variant="primary" onClick={onAddSubtheme}>＋ Add Subtheme</TbBtn>

      <div className="w-px h-6 bg-white/20 mx-1" />

      <TbBtn onClick={onToggleConnect} active={connectMode} aria-pressed={connectMode} graphOnly view={view}>
        {connectMode ? '✕ Cancel Connect' : '↔ Connect'}
      </TbBtn>
      <TbBtn onClick={onZoomOut} aria-label="Zoom out" graphOnly view={view}>−</TbBtn>
      <TbBtn onClick={onZoomIn} aria-label="Zoom in" graphOnly view={view}>＋</TbBtn>
      <TbBtn onClick={onFitView} graphOnly view={view}>⊞ Fit View</TbBtn>
      <TbBtn onClick={onAlign} graphOnly view={view}>⊹ Align</TbBtn>

      <div className="w-px h-6 bg-white/20 mx-1" />

      <TbBtn onClick={onUndo} disabled={!canUndo} aria-label="Undo">⟲ Undo</TbBtn>
      <TbBtn onClick={onRedo} disabled={!canRedo} aria-label="Redo">⟳ Redo</TbBtn>

      <div className="w-px h-6 bg-white/20 mx-1" />

      <TbBtn onClick={onExportPng}>↓ PNG</TbBtn>
      <TbBtn onClick={onExportPdf}>↓ PDF</TbBtn>

      {/* Search — progressive disclosure */}
      <div role="search" className="flex items-center gap-2 ml-auto">
        {searchOpen && (
          <>
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search nodes…"
              aria-label="Search nodes"
              className="text-base text-[#0f0d0a] border-2 border-white px-3 py-2 w-52 focus:outline-none focus:border-[#dc2626] font-bold"
              style={{ backgroundColor: '#ffffff' }}
            />
            {searchQuery.trim() && (
              <span className="text-base font-bold text-white whitespace-nowrap" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {matchCount} {matchCount === 1 ? 'match' : 'matches'}
              </span>
            )}
            <TbBtn
              onClick={() => onSearchFilterChange('themes')}
              active={searchFilters.themes}
              aria-pressed={searchFilters.themes}
            >
              Themes
            </TbBtn>
            <TbBtn
              onClick={() => onSearchFilterChange('subthemes')}
              active={searchFilters.subthemes}
              aria-pressed={searchFilters.subthemes}
            >
              Subthemes
            </TbBtn>
            <TbBtn
              onClick={() => onSearchFilterChange('codes')}
              active={searchFilters.codes}
              aria-pressed={searchFilters.codes}
            >
              Codes
            </TbBtn>
          </>
        )}
        <TbBtn onClick={onSearchToggle} active={searchOpen} aria-pressed={searchOpen}>
          {searchOpen ? '✕ Search' : '⌕ Search'}
        </TbBtn>
        {searchOpen && (
          <span className="sr-only" aria-live="polite">{matchCount} nodes matched</span>
        )}
      </div>

      <span className="relative inline-flex">
        <TbBtn onClick={onHelp} active={helpOpen} aria-pressed={helpOpen}>? Help</TbBtn>
        {showHelpHint && !helpOpen && (
          // one-time "you haven't seen the help yet" nudge — cleared on first open
          <span aria-hidden="true" className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#dc2626] border-2 border-white" />
        )}
      </span>
      <TbBtn onClick={onTogglePhysics} active={physicsOpen} aria-pressed={physicsOpen} graphOnly view={view}>⚙ Physics</TbBtn>
      <TbBtn variant="danger" onClick={onClear}>✕ Clear</TbBtn>
    </div>
  );
}