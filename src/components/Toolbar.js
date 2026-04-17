/**
 * Toolbar.js
 * ──────────────────────────────────────────────────────────────────────────
 * Top toolbar with all primary actions.
 *
 * PROPS:
 *   connectMode     {boolean}
 *   physicsOpen     {boolean}
 *   onImport        {fn}
 *   onAddTheme      {fn}
 *   onAddCode       {fn}
 *   onToggleConnect {fn}
 *   onExportPng     {fn}
 *   onExportPdf     {fn}
 *   onTogglePhysics {fn}
 *   onClear         {fn}
 */

import React, { useRef, useEffect } from 'react';

function TbBtn({ children, onClick, variant = 'secondary', active = false, ...rest }) {
  const base = 'px-4 py-2 font-bold text-base cursor-pointer transition-all border-2';
  const styles = {
    primary: 'bg-[#dc2626] text-white border-[#dc2626] hover:bg-[#b91c1c] shadow-[3px_3px_0_#0f0d0a]',
    secondary: active
      ? 'bg-white text-[#dc2626] border-[#dc2626]'
      : 'bg-transparent text-white border-white hover:bg-white hover:text-[#0f0d0a]',
    danger: 'bg-transparent text-[#dc2626] border-[#dc2626] hover:bg-[#dc2626] hover:text-white',
  };
  return (
    <button className={`${base} ${styles[variant]}`} onClick={onClick} {...rest}>
      {children}
    </button>
  );
}

export default function Toolbar({
  connectMode,
  physicsOpen,
  onImport,
  onAddTheme,
  onAddCode,
  onToggleConnect,
  onFitView,
  onZoomIn,
  onZoomOut,
  onExportPng,
  onExportPdf,
  onTogglePhysics,
  onAlign,
  onClear,
  searchOpen,
  searchQuery,
  searchFilters,
  onSearchToggle,
  onSearchChange,
  onSearchFilterChange,
  matchCount = 0,
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

      <TbBtn variant="primary" onClick={onImport}>⬆ Import</TbBtn>
      <TbBtn variant="primary" onClick={onAddTheme}>＋ Add Theme</TbBtn>
      <TbBtn variant="primary" onClick={onAddCode}>＋ Add Code</TbBtn>

      <div className="w-px h-6 bg-white/20 mx-1" />

      <TbBtn onClick={onToggleConnect} active={connectMode} aria-pressed={connectMode}>
        {connectMode ? '✕ Cancel Connect' : '↔ Connect'}
      </TbBtn>
      <TbBtn onClick={onZoomOut} aria-label="Zoom out">−</TbBtn>
      <TbBtn onClick={onZoomIn} aria-label="Zoom in">＋</TbBtn>
      <TbBtn onClick={onFitView}>⊞ Fit View</TbBtn>
      <TbBtn onClick={onAlign}>⊹ Align</TbBtn>

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
            <TbBtn
              onClick={() => onSearchFilterChange('themes')}
              active={searchFilters.themes}
              aria-pressed={searchFilters.themes}
            >
              Themes
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

      <TbBtn onClick={onTogglePhysics} active={physicsOpen} aria-pressed={physicsOpen}>⚙ Physics</TbBtn>
      <TbBtn variant="danger" onClick={onClear}>✕ Clear</TbBtn>
    </div>
  );
}