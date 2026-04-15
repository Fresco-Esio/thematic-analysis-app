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

import React from 'react';

function TbBtn({ children, onClick, variant = 'secondary', active = false }) {
  const base    = 'px-4 py-2 rounded-lg font-semibold text-base transition-all cursor-pointer border-0';
  const styles  = {
    primary:   'bg-indigo-600 text-white hover:bg-indigo-500',
    secondary: `bg-transparent text-slate-400 border border-slate-600 hover:bg-slate-700 hover:text-slate-200 ${active ? 'bg-indigo-900 text-indigo-300 border-indigo-500' : ''}`,
    danger:    'bg-transparent text-red-400 border border-red-900 hover:bg-red-900/30',
  };
  return (
    <button className={`${base} ${styles[variant]}`} onClick={onClick}>
      {children}
    </button>
  );
}

export default function Toolbar({ connectMode, physicsOpen, onImport, onAddTheme, onAddCode, onToggleConnect, onExportPng, onExportPdf, onTogglePhysics, onClear }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 border-b border-slate-700 z-10 flex-shrink-0 flex-wrap">
      {/* App title */}
      <span className="text-xl font-bold text-slate-200 mr-3">
        Thematic<span className="text-indigo-400">Map</span>
      </span>

      <TbBtn variant="primary" onClick={onImport}>⬆ Import</TbBtn>
      <TbBtn onClick={onAddTheme}>＋ Add Theme</TbBtn>
      <TbBtn onClick={onAddCode}>＋ Add Code</TbBtn>

      <div className="w-px h-6 bg-slate-600 mx-1" />

      <TbBtn onClick={onToggleConnect} active={connectMode}>
        {connectMode ? '✕ Cancel Connect' : '↔ Connect'}
      </TbBtn>

      <div className="w-px h-6 bg-slate-600 mx-1" />

      <TbBtn onClick={onExportPng}>↓ PNG</TbBtn>
      <TbBtn onClick={onExportPdf}>↓ PDF</TbBtn>

      <div className="flex-1" />

      <TbBtn onClick={onTogglePhysics} active={physicsOpen}>⚙ Physics</TbBtn>
      <TbBtn variant="danger" onClick={onClear}>✕ Clear</TbBtn>
    </div>
  );
}