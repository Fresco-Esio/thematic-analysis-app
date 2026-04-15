/**
 * ImportModal.js
 * ──────────────────────────────────────────────────────────────────────────
 * Two-step import wizard for Excel/CSV data.
 *
 * STEP 1 — Upload:
 *   Drag-and-drop or click-to-browse. Accepts .xlsx and .csv.
 *   Shows template download button.
 *
 * STEP 2 — Preview & Confirm:
 *   Table showing first 8 rows with code label, truncated quote, theme badge.
 *   Summary of how many nodes will be created.
 *   Option to clear existing canvas before import or append to it.
 *
 * PROPS:
 *   open      {boolean}
 *   onClose   {fn}
 */

import React, { useState, useRef } from 'react';
import { useGraph, useGraphDispatch } from '../../context/GraphContext';
import { parseFile, buildGraphFromRows, generateTemplate } from '../../utils/importUtils';
import { UNASSIGNED_COLOR } from '../../context/GraphContext';

export default function ImportModal({ open, onClose }) {
  const { nodes }  = useGraph();
  const dispatch   = useGraphDispatch();

  const [step,     setStep]     = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [rows,     setRows]     = useState([]);
  const [result,   setResult]   = useState(null); // buildGraphFromRows output
  const [clearFirst, setClearFirst] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef(null);

  if (!open) return null;

  // ── File handling ──────────────────────────────────────────────────────────
  async function handleFile(file) {
    if (!file) return;
    setLoading(true);
    setError(null);
    setFileName(file.name);
    try {
      const parsed = await parseFile(file);
      setRows(parsed);

      const existingThemes = nodes.filter(n => n.type === 'theme');
      const built = buildGraphFromRows(parsed, clearFirst ? [] : existingThemes);
      setResult(built);
      setStep(2);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  }

  function handleInputChange(e) {
    handleFile(e.target.files[0]);
  }

  // ── Confirm import ─────────────────────────────────────────────────────────
  function handleConfirm() {
    if (!result) return;

    if (clearFirst) dispatch({ type: 'CLEAR' });

    // Add theme nodes first (so code nodes can reference them)
    if (result.themeNodes.length > 0) {
      dispatch({ type: 'ADD_NODES', nodes: result.themeNodes });
    }
    if (result.codeNodes.length > 0) {
      dispatch({ type: 'ADD_NODES', nodes: result.codeNodes });
    }
    result.edges.forEach(edge => {
      dispatch({ type: 'ADD_EDGE', edge });
    });

    handleClose();
  }

  // ── Template download ──────────────────────────────────────────────────────
  function handleTemplateDownload() {
    const data = generateTemplate();
    const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'thematic-analysis-template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleClose() {
    setStep(1); setRows([]); setResult(null); setError(null); setFileName('');
    onClose();
  }

  // ── Preview rows (first 8) ─────────────────────────────────────────────────
  const previewRows = result
    ? result.codeNodes.slice(0, 8).map(cn => {
        const theme = result.themeNodes.find(t => t.id === cn.primaryThemeId)
          ?? nodes.find(n => n.id === cn.primaryThemeId);
        return { code: cn.label, quote: cn.quote, theme, unassigned: !cn.primaryThemeId };
      })
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={handleClose}>
      <div className="bg-slate-800 border border-slate-600 rounded-2xl p-7 w-[700px] max-w-full shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-6">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base font-bold ${step === 1 ? 'bg-indigo-600 text-white' : 'bg-slate-600 text-slate-400'}`}>1</div>
          <div className="flex-1 h-px bg-slate-600" />
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base font-bold ${step === 2 ? 'bg-indigo-600 text-white' : 'bg-slate-600 text-slate-400'}`}>2</div>
        </div>

        {/* ── STEP 1: Upload ─────────────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <h2 className="text-xl font-bold text-white mb-1">Import Data</h2>
            <p className="text-base text-slate-400 mb-6">Upload a .xlsx or .csv file. Expected columns: Source, Quoted Text, Code, Preliminary Theme.</p>

            {/* Drop zone */}
            <div
              className="border-2 border-dashed border-slate-600 rounded-xl p-10 text-center cursor-pointer hover:border-indigo-500 hover:text-indigo-400 transition-colors mb-5 text-slate-400"
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="text-4xl mb-3">📂</div>
              <p className="text-base">Drag & drop your file here, or <span className="text-indigo-400 font-semibold">click to browse</span></p>
              <p className="text-base text-slate-500 mt-2">Accepts .xlsx and .csv</p>
            </div>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleInputChange} />

            {/* Template download */}
            <div className="flex items-center gap-3 mb-5">
              <span className="text-base text-slate-400">Need a template?</span>
              <button onClick={handleTemplateDownload} className="text-base font-semibold text-indigo-400 hover:text-indigo-300 border border-slate-600 px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors">
                ↓ Download Template
              </button>
            </div>

            {/* Clear option */}
            <label className="flex items-center gap-3 cursor-pointer mb-6">
              <input type="checkbox" checked={clearFirst} onChange={e => setClearFirst(e.target.checked)} className="w-5 h-5 accent-indigo-500" />
              <span className="text-base text-slate-300">Clear existing canvas before importing</span>
            </label>

            {error && <p className="text-base text-red-400 mb-4">⚠ {error}</p>}
            {loading && <p className="text-base text-slate-400">Parsing file…</p>}

            <div className="flex justify-end">
              <button onClick={handleClose} className="text-base font-semibold text-slate-400 px-5 py-2 rounded-lg border border-slate-600 hover:bg-slate-700 transition-colors">
                Cancel
              </button>
            </div>
          </>
        )}

        {/* ── STEP 2: Preview ────────────────────────────────────────────────── */}
        {step === 2 && result && (
          <>
            <h2 className="text-xl font-bold text-white mb-1">Preview Import</h2>
            <p className="text-base text-slate-400 mb-1">
              From <span className="text-white font-semibold">{fileName}</span>
            </p>
            <p className="text-base text-slate-400 mb-5">
              <span className="text-white font-semibold">{result.summary.codeCount}</span> code nodes,{' '}
              <span className="text-white font-semibold">{result.summary.themeCount}</span> new theme nodes —{' '}
              <span className="text-emerald-400 font-semibold">{result.summary.assigned} assigned</span>,{' '}
              <span className="text-slate-400 font-semibold">{result.summary.unassigned} unassigned</span>
            </p>

            {/* Preview table */}
            <div className="overflow-hidden rounded-xl border border-slate-700 mb-5">
              <table className="w-full text-base">
                <thead className="bg-slate-900">
                  <tr>
                    <th className="text-left px-4 py-3 text-slate-400 font-semibold">Code</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-semibold">Quote</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-semibold">Theme</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-t border-slate-700 hover:bg-slate-700/40">
                      <td className="px-4 py-3 text-white font-medium max-w-[180px] truncate">{row.code}</td>
                      <td className="px-4 py-3 text-slate-400 italic max-w-[220px] truncate">"{row.quote}"</td>
                      <td className="px-4 py-3">
                        {row.theme
                          ? <span className="text-base font-bold px-3 py-1 rounded-full text-white" style={{ backgroundColor: row.theme.color }}>{row.theme.label}</span>
                          : <span className="text-base font-bold px-3 py-1 rounded-full text-white bg-slate-600">Unassigned</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.summary.codeCount > 8 && (
                <p className="text-base text-slate-500 px-4 py-2 bg-slate-900 text-center">
                  … and {result.summary.codeCount - 8} more rows
                </p>
              )}
            </div>

            <div className="flex justify-between items-center">
              <button onClick={() => setStep(1)} className="text-base font-semibold text-slate-400 px-5 py-2 rounded-lg border border-slate-600 hover:bg-slate-700 transition-colors">
                ← Back
              </button>
              <div className="flex gap-3">
                <button onClick={handleClose} className="text-base font-semibold text-slate-400 px-5 py-2 rounded-lg border border-slate-600 hover:bg-slate-700 transition-colors">
                  Cancel
                </button>
                <button onClick={handleConfirm} className="text-base font-bold text-white px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors">
                  ✓ Confirm Import
                </button>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
